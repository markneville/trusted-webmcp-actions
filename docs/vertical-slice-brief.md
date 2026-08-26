# Trusted WebMCP Actions: vertical-slice brief

Status: implementation brief

Prepared: 25 August 2026

Validation status: original traffic-shift slice passed deterministic QA, public deployment, and native Chrome registry execution. The one-time review handoff has passed deterministic tests and local native Chrome execution; its public-origin rerun and ChatGPT model-selection acceptance remain pending.

## Purpose

- **Dashboard/product:** a competition reference control room proving that a browser agent can inspect a seeded service incident and perform one bounded mitigation through genuine WebMCP.
- **Top-level outcome:** an incident commander can establish a short-lived mandate, observe the agent move the live page from degraded to stable within a 25% traffic-shift limit, and approve an exact release change once without expanding the whole mandate.
- **Why a dashboard is appropriate:** the human and agent must share current incident, authority, action, and evidence state while the human retains activation, revocation, and reset controls.
- **Success condition:** in the ChatGPT in-app browser with a WebMCP-enabled model, the agent stabilises the page, stages a release proposal, pauses while the human approves the exact request, resumes through a newly registered one-time execution tool, and cannot replay it. The complete reset-to-release path succeeds five consecutive times.

## Decisions and actions

### Stabilise the seeded incident

- **User decision:** whether to activate a 15-minute, service-specific mandate for the browser agent.
- **Question answered:** is `checkout-api` currently degraded, and what bounded reversible mitigation is available?
- **Action threshold:** seeded error rate is above the 5% stable threshold; a 20% standby shift reduces the reference state below that threshold.
- **Evidence before action:** service identifier, error rate, p95 latency, current traffic allocation, provenance, freshness, mandate status, and remaining shift allowance.
- **Stale/partial/denied behaviour:** missing native WebMCP is shown as unsupported; an absent, expired, revoked, or exhausted mandate returns a denial without changing traffic.

### Revoke or reset

- **User decision:** revoke future governed agent actions or restore the original seeded scenario.
- **Question answered:** is a tool currently available, and did the control change only future governed calls?
- **Action threshold:** revocation is available only while the mandate is active; reset is always explicit.
- **Evidence before action:** mandate state, expiry, current tool roster, activity entry.
- **Limit:** revocation does not undo completed shifts. Reset is a reference-app convenience, not a production rollback claim.

### Review and execute one exact release change

- **User decision:** whether to approve the agent's exact proposed release once for five minutes.
- **Question answered:** can an agent pause at an authority boundary and resume through a capability created by human approval?
- **Evidence before action:** current and proposed versions, reason, browser-agent session, review request ID, approval ID, expiry, and current tool roster.
- **State transition:** `propose_checkout_fix_deploy` creates `review_required` without changing the release; human approval registers `execute_approved_checkout_fix`; successful execution consumes the approval and unregisters that tool.
- **Limit:** every effect is confined to seeded browser-page state; no external deployment is claimed.

## Audience and context

- **Primary user and authority:** an incident commander evaluating a bounded browser-agent action.
- **Secondary users/reviewers:** WebMCP Challenge judges, developers inspecting the public repository, and DGM product reviewers.
- **Usage:** one short live demonstration plus repeatable technical evaluation.
- **Device/context:** desktop is primary for ChatGPT side-by-side use; tablet and mobile must preserve the decision hierarchy.
- **Assumed knowledge:** basic incident-response concepts; no DGM or WebMCP expertise required.

## Evidence map

| Claim | Source | Scope | Provenance | Freshness | Evidence route | Control route |
|---|---|---|---|---|---|---|
| `checkout-api` is degraded/stable | In-page incident store | Seeded reference scenario only | `seeded_reference_state` | Updated on each inspect/action | Exact metrics and activity timeline | `shift_incident_traffic` WebMCP tool |
| Traffic allocation | In-page incident store | This browser page lifetime | `live_page_state` | Immediate after allowed action | Allocation values and activity timeline | Governed tool callback |
| Mandate active/revoked/absent | In-page incident store | Current demo session | `reference_mandate_state` | Immediate after human control | Authority panel and tool roster | Human activate/revoke buttons |
| WebMCP tool availability | Native `document.modelContext` registration result | Current page | `native_webmcp` or explicit `mock_harness` | Current registration lifecycle | Runtime status and tool roster | AbortController registration signals |
| Allowed/review/denied result | Reference policy function | Current demo action | `reference_policy_decision` | Atomic with page-state mutation or staged review | Exact activity entry and receipt ID | Shared traffic and release policy functions |
| One-time execution capability | Page review state | Exact approved request | `reference_human_approval` | Added after approval; removed after execution/revocation | Tool roster, review panel, activity | AbortSignal-bound dynamic registration |

## Claim boundary

- The incident and telemetry are a clearly labelled seeded reference scenario, not external production infrastructure.
- Traffic changes are real application-state changes inside this reference app.
- The current slice proves a governed WebMCP page path; it does not prove universal containment, native ChatGPT identity, customer deployment, or proprietary DGM Bridge integration.
- `Native WebMCP` is shown only when `document.modelContext.registerTool` exists. The query-string mock is visibly labelled and never counts as judge-path proof.

## Constraints

- Use the current `document.modelContext.registerTool` API and registration `AbortSignal` lifecycle.
- Reuse the same policy/action function for agent execution and tests.
- No customer names, data, logos, external SaaS effects, payments, or secrets.
- No runtime dependency on a private DGM service.
- Keyboard-visible controls, semantic structure, reduced motion, readable contrast, and structured text equivalents for the visual trace.
- Initial slice must remain small enough to replace or strengthen after real-browser findings.

## Required states

- **Loading:** WebMCP registration is connecting.
- **Unsupported:** the browser does not expose the current WebMCP API.
- **Mock harness:** explicit non-judge development state.
- **Live/current:** native tools registered and page state current.
- **Permission denied:** absent, expired, revoked, or limit-exceeding mandate; no state change.
- **Review pending:** proposal is visible, release is unchanged, and no execution tool exists.
- **Approved once:** the exact completion tool exists until success, expiry, or revocation.
- **Fixture/sample:** every incident metric is labelled as seeded reference state.
- **Empty:** not applicable; reset restores the canonical seeded incident.
- **Error:** registration errors surface beside runtime status and do not pretend tools are available.

## Hierarchy options

### Option A — decision first (selected)

1. Product/runtime/provenance header.
2. Degraded/stable service answer with exact freshness.
3. Service health trace and traffic allocation.
4. Authority state and human controls.
5. Current agent-tool roster.
6. Decision/activity evidence.

This gives the film an immediate red-to-green product outcome while keeping authority visible beside the action.

### Option B — authority first (alternate)

1. Mandate/passport status and scope.
2. Available tool roster.
3. Service incident and proposed mitigation.
4. Activity/evidence timeline.

This makes the DGM thesis explicit sooner but risks reading like a governance console before the judge understands the urgent user problem. Retain it as an alternate for later testing, not the first implementation.

## Validation

- **Prototype reviewers:** Mark and one fresh viewer unfamiliar with the implementation; judge feedback is not yet available.
- **Tasks:** identify the incident, activate authority, ask the agent to inspect and shift traffic, verify the stable result, revoke, reset.
- **Misinterpretations to test:** external-production claim, client-side hiding mistaken for enforcement, mock mode mistaken for native proof, reset mistaken for rollback.
- **Viewports:** 1440×900, 1024×768, 390×844.
- **Technical checks:** typecheck, lint, unit policy tests, production build, semantic native controls, reduced-motion CSS, native WebMCP discovery, five consecutive full runs.
- **Public delivery receipt:** [source repository](https://github.com/markneville/trusted-webmcp-actions) and [HTTPS deployment](https://markneville.github.io/trusted-webmcp-actions/) are live. GitHub Pages workflow run `32916347203` deployed commit `c42e782` successfully.
- **Native runtime receipt:** after enabling Chrome's WebMCP testing flag, Chrome 151 registered and executed both tools through `document.modelContext.getTools()` and `executeTool()`. Five consecutive native reset-to-stable runs passed, along with limit denial and revocation checks.
- **Public-origin receipt:** the HTTPS deployment repeated native inspect, allowed 20% shift, limit denial without mutation, and revocation tool removal in Chrome.
- **Remaining agent gate:** the built-in browser surface was unavailable in the current Codex session, so Sol/Terra tool discovery, selection, and natural-language invocation in ChatGPT remain unproven. Neither the mock harness nor the native registry self-test is substituted for that eval.
