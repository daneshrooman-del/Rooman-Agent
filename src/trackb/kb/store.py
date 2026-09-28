"""Per-agent knowledge-base ingestion and retrieval on top of Qdrant.

Raw text is chunked, embedded with a `sentence-transformers` model, and upserted
into a Qdrant collection scoped to a single generated `knowledge_base_id`
(one collection per agent knowledge base). Retrieval embeds the query text and
runs a nearest-neighbour search against that collection.

Every external call (embedding, Qdrant) goes through an explicit timeout and a
bounded retry -- see `_embed`, `_ensure_collection`, `_upsert`, `_search`.
"""

import asyncio
import uuid
from typing import Any, Protocol

import structlog
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels
from tenacity import retry, stop_after_attempt, wait_exponential

from trackb.config import Settings, get_settings

logger = structlog.get_logger(__name__)

EMBEDDING_TIMEOUT_SECONDS = 30.0
QDRANT_TIMEOUT_SECONDS = 10

DEFAULT_CHUNK_SIZE = 800
DEFAULT_CHUNK_OVERLAP = 100

_RETRY = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class EmbeddingModel(Protocol):
    """The slice of `sentence_transformers.SentenceTransformer` this module needs."""

    def encode(self, *args: Any, **kwargs: Any) -> Any: ...

    def get_sentence_embedding_dimension(self) -> int | None: ...


class KnowledgeBaseIngestionError(Exception):
    """Raised when embedding or upserting a knowledge base's documents fails."""


class KnowledgeBaseQueryError(Exception):
    """Raised when querying a knowledge base fails."""


_model_cache: dict[str, EmbeddingModel] = {}


def _load_embedding_model(model_name: str) -> EmbeddingModel:
    if model_name not in _model_cache:
        # Imported lazily so importing this module never requires the (heavy) model
        # download unless a real model actually needs to be loaded.
        from sentence_transformers import SentenceTransformer

        _model_cache[model_name] = SentenceTransformer(model_name)
    return _model_cache[model_name]


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """Split `text` into overlapping fixed-size character chunks."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and smaller than chunk_size")

    stripped = text.strip()
    if not stripped:
        return []

    chunks: list[str] = []
    step = chunk_size - overlap
    start = 0
    while start < len(stripped):
        chunk = stripped[start : start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
        start += step
    return chunks


def _prepare_chunks(
    documents: list[str],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    chunks: list[str] = []
    for document in documents:
        if len(document) <= chunk_size:
            stripped = document.strip()
            if stripped:
                chunks.append(stripped)
        else:
            chunks.extend(chunk_text(document, chunk_size=chunk_size, overlap=overlap))
    return chunks


def _collection_name(knowledge_base_id: str) -> str:
    return f"kb_{knowledge_base_id}"


async def _embed(model: EmbeddingModel, texts: list[str]) -> list[list[float]]:
    async def _run() -> Any:
        return await asyncio.to_thread(model.encode, texts, convert_to_numpy=True)

    try:
        raw_vectors = await asyncio.wait_for(_run(), timeout=EMBEDDING_TIMEOUT_SECONDS)
    except TimeoutError as exc:
        raise KnowledgeBaseIngestionError("embedding call timed out") from exc
    except Exception as exc:
        raise KnowledgeBaseIngestionError(f"embedding call failed: {exc}") from exc

    return [
        vector.tolist() if hasattr(vector, "tolist") else list(vector) for vector in raw_vectors
    ]


class KnowledgeBaseStore:
    """Chunk -> embed -> upsert/query against Qdrant, one collection per agent KB."""

    def __init__(
        self,
        settings: Settings | None = None,
        qdrant_client: AsyncQdrantClient | None = None,
        embedding_model: EmbeddingModel | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = qdrant_client or AsyncQdrantClient(
            url=self._settings.qdrant_url, timeout=QDRANT_TIMEOUT_SECONDS
        )
        self._model = embedding_model or _load_embedding_model(self._settings.embedding_model_name)

    async def ingest(
        self,
        agent_id: str,
        documents: list[str],
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_CHUNK_OVERLAP,
    ) -> str:
        """Chunk, embed, and store `documents` for `agent_id`. Returns a `knowledge_base_id`."""
        chunks = _prepare_chunks(documents, chunk_size=chunk_size, overlap=overlap)
        if not chunks:
            raise ValueError("documents must contain at least one non-empty chunk of text")

        knowledge_base_id = f"{agent_id}-{uuid.uuid4().hex[:8]}"
        collection_name = _collection_name(knowledge_base_id)

        vectors = await _embed(self._model, chunks)
        await self._ensure_collection(collection_name, dimension=len(vectors[0]))

        points = [
            qmodels.PointStruct(
                id=str(uuid.uuid4()),
                vector=vector,
                payload={"text": chunk, "agent_id": agent_id},
            )
            for chunk, vector in zip(chunks, vectors, strict=True)
        ]
        await self._upsert(collection_name, points)

        logger.info(
            "kb_ingested",
            agent_id=agent_id,
            knowledge_base_id=knowledge_base_id,
            chunk_count=len(chunks),
        )
        return knowledge_base_id

    async def query(self, knowledge_base_id: str, text: str, top_k: int = 5) -> list[str]:
        """Return up to `top_k` chunks from `knowledge_base_id` most relevant to `text`."""
        collection_name = _collection_name(knowledge_base_id)
        vectors = await _embed(self._model, [text])
        points = await self._query_points(collection_name, vectors[0], top_k)

        logger.info(
            "kb_queried",
            knowledge_base_id=knowledge_base_id,
            result_count=len(points),
        )
        return [
            point.payload["text"]
            for point in points
            if point.payload and "text" in point.payload
        ]

    @_RETRY
    async def _ensure_collection(self, collection_name: str, dimension: int) -> None:
        try:
            exists = await self._client.collection_exists(collection_name)
            if not exists:
                await self._client.create_collection(
                    collection_name=collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=dimension, distance=qmodels.Distance.COSINE
                    ),
                )
        except Exception as exc:
            raise KnowledgeBaseIngestionError(
                f"failed to prepare collection {collection_name!r}: {exc}"
            ) from exc

    @_RETRY
    async def _upsert(self, collection_name: str, points: list[Any]) -> None:
        try:
            await self._client.upsert(collection_name=collection_name, points=points)
        except Exception as exc:
            raise KnowledgeBaseIngestionError(
                f"failed to upsert into {collection_name!r}: {exc}"
            ) from exc

    @_RETRY
    async def _query_points(
        self, collection_name: str, vector: list[float], top_k: int
    ) -> list[Any]:
        try:
            response = await self._client.query_points(
                collection_name=collection_name, query=vector, limit=top_k
            )
        except Exception as exc:
            raise KnowledgeBaseQueryError(f"failed to search {collection_name!r}: {exc}") from exc
        return list(response.points)


_default_store: KnowledgeBaseStore | None = None


def _get_default_store() -> KnowledgeBaseStore:
    global _default_store
    if _default_store is None:
        _default_store = KnowledgeBaseStore()
    return _default_store


async def ingest(agent_id: str, documents: list[str]) -> str:
    """Ingest `documents` for `agent_id` into its knowledge base. Returns `knowledge_base_id`."""
    return await _get_default_store().ingest(agent_id, documents)


async def query(knowledge_base_id: str, text: str, top_k: int = 5) -> list[str]:
    """Retrieve up to `top_k` chunks from `knowledge_base_id` relevant to `text`."""
    return await _get_default_store().query(knowledge_base_id, text, top_k)
