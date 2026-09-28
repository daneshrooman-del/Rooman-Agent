import pytest

from trackb.contracts import (
    AgentSpec,
    FlowGraph,
    FlowState,
    FlowTransition,
    StubAvatarServiceClient,
)


def _sample_flow_graph() -> FlowGraph:
    return FlowGraph(
        entry_state="greet",
        states=[
            FlowState(
                name="greet",
                objective="Greet the caller and confirm the purpose of the call",
                transitions=[FlowTransition(on="purpose_confirmed", to_state="collect_requirements")],
            ),
            FlowState(
                name="collect_requirements",
                objective="Collect job/candidate requirements",
                transitions=[FlowTransition(on="requirements_complete", to_state="done")],
            ),
            FlowState(name="done", objective="Wrap up the call", is_terminal=True),
        ],
    )


def test_agent_spec_round_trips_through_json() -> None:
    spec = AgentSpec(
        agent_id="agent-1",
        owner="user-1",
        purpose="HR placement calling agent",
        persona_prompt="You are a helpful placement coordinator.",
        flow_graph=_sample_flow_graph(),
        avatar_id="stub-avatar-1",
        voice_id="voice-1",
        created_from_session_id="session-1",
    )

    restored = AgentSpec.model_validate_json(spec.model_dump_json())

    assert restored == spec
    assert restored.status == "draft"
    assert restored.channels == ["web"]
    assert restored.flow_graph.entry_state == "greet"


@pytest.mark.asyncio
async def test_stub_avatar_service_client_round_trip() -> None:
    client = StubAvatarServiceClient()

    avatar_id = await client.create_avatar(b"fake-video-bytes")
    video = await client.generate(avatar_id, "hello there", action_type="talk")

    assert avatar_id.startswith("stub-avatar-")
    assert video == b"STUB_VIDEO:talk:hello there"


@pytest.mark.asyncio
async def test_stub_avatar_service_client_rejects_unknown_avatar() -> None:
    client = StubAvatarServiceClient()

    with pytest.raises(KeyError):
        await client.generate("does-not-exist", "hi", action_type="talk")
