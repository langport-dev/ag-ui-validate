# Spec questions & ambiguities

Ambiguities found while deriving the validator's rules from `@ag-ui/core` (v0.0.58)
and [docs.ag-ui.com](https://docs.ag-ui.com). Per this project's working agreements,
behaviour the spec does not clearly govern is validated at `info` severity at most;
each entry here is a candidate issue for
[`ag-ui-protocol/ag-ui`](https://github.com/ag-ui-protocol/ag-ui).

Status legend: **open** (not yet filed) · **filed** (issue link) · **resolved**.

---

## SQ-1: Initial state — is `STATE_DELTA` before any `STATE_SNAPSHOT` legal? — open

[concepts/state](https://docs.ag-ui.com/concepts/state) says snapshots are
"typically sent at the beginning of an interaction" — *typically*, not *must*.
`RunAgentInput.state` also carries state into a run, and that channel is invisible
to a passive observer of the output stream, so a `STATE_DELTA` with no prior
snapshot may be perfectly valid (it applies against input-seeded state).

**Validator behaviour:** AGUI301 is downgraded to `info` (the project spec drafted
it as `error`). AGUI302 (patch fails to apply) is only evaluated once a
`STATE_SNAPSHOT` has established a known base — before that, only patch
*shape* (AGUI303) is checked. Reconstructing state from an unknown base would
manufacture false positives.

**Question for upstream:** must a run that uses `STATE_DELTA` establish its base
with a `STATE_SNAPSHOT` first, or is `RunAgentInput.state` an equally valid base?

## SQ-2: Docs vs SDK — empty content deltas — open

The events reference documents `TextMessageContent.delta` as "Text content chunk
**(non-empty)**", but `@ag-ui/core` v0.0.58 schemas accept `delta: ""` for
`TEXT_MESSAGE_CONTENT`, `TOOL_CALL_ARGS`, and `REASONING_MESSAGE_CONTENT`.
Earlier SDK versions enforced non-empty. Note also that for
`REASONING_MESSAGE_CHUNK` an empty delta is *meaningful* (documented as
implicitly closing the message), so "empty delta" cannot be a blanket rule.

**Validator behaviour:** AGUI105 fires at `warning` for `TEXT_MESSAGE_CONTENT`
(docs govern it explicitly) and never for chunk events.

**Question for upstream:** is the docs' "(non-empty)" normative? If so, should the
SDK schemas enforce it?

**Related upstream:** [#337](https://github.com/ag-ui-protocol/ag-ui/issues/337),
[#835](https://github.com/ag-ui-protocol/ag-ui/issues/835) — closed as middleware
bugs, but they show the Python SDK *rejects* empty deltas while the TS SDK
accepts them, so the SDKs disagree with each other as well as with the docs.

## SQ-3: Docs vs SDK — `TextMessageStart.role` — open

Two mismatches:
1. The docs table lists `role` values `("developer", "system", "assistant",
   "user", "tool")`; the SDK union omits `"tool"` and rejects it.
2. The docs mark `role` required; the SDK gives it a default, so wire events
   without `role` parse fine.

**Validator behaviour:** the SDK wins (per this project's grounding policy):
`role` optional, `"tool"` flagged by AGUI504 as failing the declared schema.

## SQ-4: Reasoning block nesting is described, not mandated — open

[concepts/reasoning](https://docs.ag-ui.com/concepts/reasoning) shows
`REASONING_MESSAGE_*` nested inside `REASONING_START`/`REASONING_END` only as "a
typical reasoning flow"; nothing states the nesting is mandatory.
`REASONING_START` and `REASONING_MESSAGE_START` carry *different* `messageId`s.

**Validator behaviour:** AGUI401 enforces the well-grounded part — a
`REASONING_MESSAGE_CONTENT` whose `messageId` has no open
`REASONING_MESSAGE_START` (mirror of AGUI101, `error`). Content outside a
`REASONING_START`/`END` *block* is not flagged. AGUI402 (unterminated
`REASONING_START` at run end) runs at `warning`, not `error`.

**Question for upstream:** is `REASONING_MESSAGE_*` outside a
`REASONING_START`/`REASONING_END` block conformant?

## SQ-5: Keepalive / heartbeat is not governed by the spec — open

Nothing at docs.ag-ui.com mandates SSE keepalive frames or flush behaviour, yet
missing keepalives are a recurring real-world failure (open issues in
`ag-ui-protocol/ag-ui` and `microsoft/agent-framework`).

**Validator behaviour:** AGUI506 (no keepalive within window) and AGUI507
(buffered response) are `info`, not `warning` as first drafted — they describe
operational risk, not spec violations. Worth proposing as SHOULD-level transport
guidance upstream; if adopted, these upgrade to `warning`.

**Related upstream:** [#1001](https://github.com/ag-ui-protocol/ag-ui/issues/1001)
— a per-adapter heartbeat workaround in the ADK middleware; no protocol-level
guidance exists.

## SQ-6: Multi-run streams — serialized logs vs live responses — open

[concepts/serialization](https://docs.ag-ui.com/concepts/serialization) is
explicit that a serialized log may contain **multiple runs**, delimited by
`RunStarted` and related via `parentRunId` ("each run can branch from any
previous run"); runs do not interleave. Whether a single *live* HTTP response may
carry more than one run is not stated.

**Validator behaviour:** a `RUN_STARTED` with a new `runId` after a clean
terminal event opens a new run scope (no diagnostic). Any *other* event after a
terminal event is AGUI004. Cross-run `threadId` drift within one stream is not
flagged (a concatenated capture of two threads would false-positive).

**Question for upstream:** may a live response stream contain multiple sequential
runs, or only serialized histories?

**Related upstream:** [#2148](https://github.com/ag-ui-protocol/ag-ui/issues/2148)
— in-flight steering (new `runId` + `parentRunId` vs. reusing the active run) is
an adjacent scenario whose answer probably decides this too.

## SQ-7: Draft `META` events — open

[drafts/meta-events](https://docs.ag-ui.com/drafts/meta-events) defines
`type: "META"` (`metaType`, `payload`), but `@ag-ui/core` v0.0.58 has no `META`
in `EventType`. A stream emitting it follows the docs but fails the SDK.

**Validator behaviour:** AGUI503 (unknown event type) special-cases documented
draft types: `META` is reported at `info` citing the draft page, not `error`.

## SQ-8: Deprecated `THINKING_*` events — proposed new rule — open

`@ag-ui/core` marks all five `THINKING_*` events `@deprecated` ("Will be removed
in 1.0.0"; replaced by `REASONING_*`). A "deprecated event type used" hygiene
rule (AGUI9xx, `info`) seems warranted, but the project's working agreement is to
propose rule additions upstream rather than invent them silently.

**Validator behaviour:** none yet — `THINKING_*` events validate against their
schemas without complaint.

## SQ-9: Chunk events mixed with explicit Start/Content/End — open

`TEXT_MESSAGE_CHUNK` "expands to Start → Content → End automatically", and the
first chunk must carry `messageId` (`toolCallId`/`toolCallName` for
`TOOL_CALL_CHUNK`). Nothing says whether interleaving chunk and explicit
lifecycle events for the *same* id is legal.

**Validator behaviour:** chunks participate in the same per-id state machine
(first chunk opens; docs-mandated first-chunk fields enforced via AGUI504).
Mixing forms on one id is not flagged.

## SQ-10: Step semantics — duplicates and nesting — open

Steps pair by `stepName` ("The `stepName` must match the corresponding
`StepStarted` event") and "may occur multiple times within a run". Undefined:
a second `STEP_STARTED` for a name that is already open, and whether steps may
nest/overlap.

**Validator behaviour:** overlapping steps with different names are accepted; a
duplicate open of the same name is treated as re-entrant (a counter), not an
error. Only `STEP_FINISHED` with no open matching name (AGUI006) and
still-open steps at run end (AGUI007) are flagged.

## SQ-11: `parentMessageId` may reference history the stream never carried — open

`TOOL_CALL_START.parentMessageId` can point at a message from prior conversation
history that this run never streamed. An "unknown parentMessageId" can therefore
be entirely valid.

**Validator behaviour:** AGUI208 downgraded to `info` (drafted as `warning`); it
only reports ids seen in neither a `TEXT_MESSAGE_START` nor a
`MESSAGES_SNAPSHOT`.

## SQ-12: `parentRunId` referencing a run absent from the capture — candidate rule — open

With branching (SQ-6), a `RUN_STARTED.parentRunId` naming a run not present in
the stream may simply mean a partial capture. Candidate `info` rule upstream;
not implemented.

## SQ-13: Capability discovery is out-of-band — resolved (documented)

[concepts/capabilities](https://docs.ag-ui.com/concepts/capabilities):
`AbstractAgent.getCapabilities()` is optional, client-side, and not an event on
the stream. A passive stream validator cannot observe it; the feature matrix is
therefore *inferred* from observed events and labelled as such. (Relevant to
`ag-ui#2192`.)

## SQ-14: Is there a naming convention for CUSTOM events? — open

[concepts/events#custom](https://docs.ag-ui.com/concepts/events#custom) says
"Teams should document their custom events to ensure consistent implementation"
but prescribes no naming convention. Un-namespaced names (`update` vs
`acme.update`) collide across vendors.

**Validator behaviour:** AGUI903 fires at `info` only, explicitly labelled a
convention, not a spec requirement.

**Question for upstream:** should CUSTOM event names be namespaced
(reverse-DNS or `vendor.name`)?
