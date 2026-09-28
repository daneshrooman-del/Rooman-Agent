from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest

from trackb.kb.store import (
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    KnowledgeBaseQueryError,
    KnowledgeBaseStore,
    chunk_text,
)


class FakeEmbeddingModel:
    """A stand-in for `sentence_transformers.SentenceTransformer`.

    Returns a deterministic vector per text (based on its length) so tests don't need
    a real model download -- Qdrant itself is also mocked, so no live infra is needed.
    """

    def __init__(self, dimension: int = 4) -> None:
        self.dimension = dimension
        self.calls: list[list[str]] = []

    def encode(self, sentences: list[str], convert_to_numpy: bool = True) -> Any:
        self.calls.append(list(sentences))
        return [[float(len(text) % 7 + 1)] * self.dimension for text in sentences]

    def get_sentence_embedding_dimension(self) -> int | None:
        return self.dimension


def _make_qdrant_client(collection_exists: bool = False) -> AsyncMock:
    client = AsyncMock()
    client.collection_exists.return_value = collection_exists
    client.create_collection.return_value = None
    client.upsert.return_value = None
    client.query_points.return_value = SimpleNamespace(points=[])
    return client


def test_chunk_text_splits_long_text_with_overlap() -> None:
    text = "a" * 2000
    chunks = chunk_text(text, chunk_size=800, overlap=100)

    assert len(chunks) > 1
    assert all(len(chunk) <= 800 for chunk in chunks)


def test_chunk_text_empty_input_returns_no_chunks() -> None:
    assert chunk_text("   ") == []


def test_chunk_text_rejects_bad_overlap() -> None:
    with pytest.raises(ValueError):
        chunk_text("hello world", chunk_size=10, overlap=10)


async def test_ingest_embeds_chunks_and_upserts_into_new_collection() -> None:
    client = _make_qdrant_client(collection_exists=False)
    model = FakeEmbeddingModel()
    store = KnowledgeBaseStore(qdrant_client=client, embedding_model=model)

    knowledge_base_id = await store.ingest("agent-123", ["short doc one", "short doc two"])

    assert knowledge_base_id.startswith("agent-123-")
    client.collection_exists.assert_awaited_once()
    client.create_collection.assert_awaited_once()
    client.upsert.assert_awaited_once()

    upsert_kwargs = client.upsert.await_args.kwargs
    assert upsert_kwargs["collection_name"] == f"kb_{knowledge_base_id}"
    points = upsert_kwargs["points"]
    assert len(points) == 2
    assert {point.payload["text"] for point in points} == {"short doc one", "short doc two"}
    assert all(point.payload["agent_id"] == "agent-123" for point in points)


async def test_ingest_skips_collection_creation_if_it_already_exists() -> None:
    client = _make_qdrant_client(collection_exists=True)
    model = FakeEmbeddingModel()
    store = KnowledgeBaseStore(qdrant_client=client, embedding_model=model)

    await store.ingest("agent-1", ["a document"])

    client.create_collection.assert_not_awaited()


async def test_ingest_chunks_long_documents_before_embedding() -> None:
    client = _make_qdrant_client()
    model = FakeEmbeddingModel()
    store = KnowledgeBaseStore(qdrant_client=client, embedding_model=model)

    long_document = "word " * 1000
    await store.ingest(
        "agent-1",
        [long_document],
        chunk_size=DEFAULT_CHUNK_SIZE,
        overlap=DEFAULT_CHUNK_OVERLAP,
    )

    embedded_texts = model.calls[0]
    assert len(embedded_texts) > 1


async def test_ingest_raises_on_empty_documents() -> None:
    client = _make_qdrant_client()
    model = FakeEmbeddingModel()
    store = KnowledgeBaseStore(qdrant_client=client, embedding_model=model)

    with pytest.raises(ValueError):
        await store.ingest("agent-1", ["   ", ""])


async def test_query_embeds_text_and_returns_matched_chunk_texts() -> None:
    client = _make_qdrant_client()

    hit_a = SimpleNamespace(payload={"text": "chunk A"})
    hit_b = SimpleNamespace(payload={"text": "chunk B"})
    client.query_points.return_value = SimpleNamespace(points=[hit_a, hit_b])

    model = FakeEmbeddingModel()
    store = KnowledgeBaseStore(qdrant_client=client, embedding_model=model)

    results = await store.query("kb-abc123", "what is the return policy?", top_k=2)

    assert results == ["chunk A", "chunk B"]
    query_kwargs = client.query_points.await_args.kwargs
    assert query_kwargs["collection_name"] == "kb_kb-abc123"
    assert query_kwargs["limit"] == 2


async def test_query_raises_knowledge_base_query_error_after_retries_exhausted() -> None:
    client = _make_qdrant_client()
    client.query_points.side_effect = RuntimeError("qdrant unreachable")

    model = FakeEmbeddingModel()
    store = KnowledgeBaseStore(qdrant_client=client, embedding_model=model)

    with pytest.raises(KnowledgeBaseQueryError):
        await store.query("kb-abc123", "hello", top_k=3)

    assert client.query_points.await_count == 3


async def test_upsert_retries_transient_failures_then_succeeds() -> None:
    client = _make_qdrant_client()
    client.upsert.side_effect = [RuntimeError("transient"), None]

    model = FakeEmbeddingModel()
    store = KnowledgeBaseStore(qdrant_client=client, embedding_model=model)

    knowledge_base_id = await store.ingest("agent-1", ["a document"])

    assert knowledge_base_id
    assert client.upsert.await_count == 2
