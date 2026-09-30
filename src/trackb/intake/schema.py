"""The slot schema the intake conversation fills in.

This is internal to Track B (not part of the cross-track contract in
`trackb.contracts`), but both `intake` (fills it) and `flowgen` (consumes it to
produce a FlowGraph) depend on its shape, so it's defined once, here.
"""

from pydantic import BaseModel, Field

REQUIRED_SLOTS = (
    "purpose",
    "caller_persona",
    "workflow_steps",
    "languages",
)


class IntakeSlots(BaseModel):
    purpose: str | None = Field(
        default=None,
        description="What the agent being built is for, in the requester's own words, "
        "e.g. 'an agent that takes HR placement calls'",
    )
    caller_persona: str | None = Field(
        default=None,
        description="Who will call/use this agent once it's deployed, "
        "e.g. 'HR teams' or 'candidates'",
    )
    required_inputs: list[str] = Field(
        default_factory=list,
        description="Information the new agent must collect from its own callers, "
        "e.g. 'job requirements', 'candidate details'",
    )
    workflow_steps: list[str] = Field(
        default_factory=list,
        description="The ordered steps/process the new agent must drive, "
        "e.g. ['confirm role', 'screen candidate', 'schedule interview']",
    )
    tools_needed: list[str] = Field(
        default_factory=list,
        description="External systems the new agent should be able to call, e.g. 'ATS', 'calendar'",
    )
    tone: str | None = Field(
        default=None,
        description="The desired tone/persona for the new agent, e.g. 'professional and warm'",
    )
    languages: list[str] = Field(
        default_factory=list, description="Language(s) the new agent must operate in"
    )

    def missing_required_slots(self) -> list[str]:
        missing = []
        for slot in REQUIRED_SLOTS:
            value = getattr(self, slot)
            if value in (None, [], ""):
                missing.append(slot)
        return missing

    def is_complete(self) -> bool:
        return not self.missing_required_slots()
