---
name: scaffold-intake-slot
description: Add a new slot to the Agent Builder's intake/slot-filling schema (Track B) — the Pydantic field, the LangGraph extraction/follow-up logic, and its test. Use when asked to add or change what information the intake conversation collects.
---

# Scaffold a new intake slot

Load `track-b-conventions` first if it isn't already in context — this skill assumes that
folder layout and contract.

Given a slot name, its type, and whether it's required, do all of the following in one pass:

1. **Schema** (`src/trackb/intake/schema.py`): add the field to the intake slot Pydantic
   model, with a `Field(description=...)` that states exactly what counts as a valid answer —
   that description is what the extraction LLM prompt is built from, so it must be precise
   enough to distinguish this slot from neighboring ones.
2. **Extraction node** (`src/trackb/intake/graph.py`): make sure the slot-filling LangGraph
   node's extraction prompt/schema picks up the new field automatically (it should, if the
   graph is built from the Pydantic model rather than a hand-listed field set — if it isn't,
   fix that instead of hand-adding the field to the prompt).
3. **Follow-up question**: if the slot is required, add a short, specific follow-up question
   for the case where it's still empty after N turns — no generic "can you clarify?", ask for
   exactly what's missing.
4. **Test** (`tests/intake/test_schema.py` or nearest matching test file): a case where the
   slot is correctly extracted from a sample utterance, and a case where it's missing and the
   follow-up question fires.
5. Update `track-b-conventions`'s contract section only if this slot changes `AgentSpec` itself
   (most intake slots feed `flow_graph` generation and don't touch `AgentSpec` directly — check
   before editing the contract file).

Run the `contract-check` skill afterward if the change touches anything in `contracts/`.
