# Vertical-slice evidence

Observed: 25 August 2026

Scope: local competition reference app only

## Claim status

| Claim | Status | Evidence |
|---|---|---|
| Policy and state-transition logic works deterministically | Passed | Seven unit tests passed. |
| The same registered-tool callback updates the visible page | Passed in the labelled mock harness | Five consecutive reset → activate → 20% shift runs produced stable state, 3.2% error rate, 360 ms p95 latency, 80/20 allocation, and receipt `TWA-REF-0001`. |
| Limit enforcement prevents excess mutation | Passed in the labelled mock harness | A second 20% request was denied because only 5% remained; allocation stayed 80/20 and `uiUpdated` was `false`. |
| Revocation changes the current tool surface | Passed in the labelled mock harness | Revocation removed `shift_incident_traffic`, retained read-only `inspect_incident`, and disabled the mock shift control. |
| Native WebMCP registers and executes in Chrome | Passed | After enabling Chrome's WebMCP testing flag, the page reported `Native WebMCP`. `getTools()` discovered the registered tools and `executeTool()` invoked them through the real browser registry. |
| Native reset-to-stable path is repeatable | Passed | Five consecutive native registry runs produced the stable 3.2% / 360 ms / 80–20 state, allowed result, `uiUpdated: true`, and receipt `TWA-REF-0001`. |
| Native enforcement and lifecycle behaviour | Passed | A second native 20% request was denied with only 5% remaining and no mutation; revocation removed the state-changing tool while retaining `inspect_incident`. |
| Sol/Terra selects and invokes the tools from natural language in ChatGPT | Not yet passed | The built-in browser surface was unavailable in this Codex session. The native registry self-test proves browser invocation, not model tool-selection accuracy. |
| Public repository and deployment exist | Not yet passed | The local Git repository exists, but GitHub CLI authentication is expired. No public URL is claimed. |

## Static gates

| Gate | Result |
|---|---|
| `npm test` | 1 file passed, 7 tests passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; `/` statically prerendered |
| `git diff --check` | Passed |

These gates were rerun after the native self-test controls, mock execution controls, and strict-mode registration fix.

## Browser checks

- Viewports checked at 1440×900, 1024×768, and 390×844.
- No horizontal overflow was observed at tablet or mobile widths.
- The initial tool roster contained only `inspect_incident`; mandate activation added `shift_incident_traffic`; revocation removed it again.
- The native Chrome registry completed five consecutive reset-to-stable cycles.
- Chrome produced no application-origin warning or error. One unrelated installed-extension error originated from `chrome-extension://cfnpidifppmenkapgihekkeednfoenal/`.
- Every human control is a native HTML `button`; the visual trace has a structured text alternative and the stylesheet includes a reduced-motion path.

## Acceptance boundary

The `?mockWebMCP=1` harness calls the exact callbacks registered by the application and is useful deterministic evidence. It is explicitly labelled in the interface and is **not** evidence that ChatGPT or Chrome discovered and invoked native WebMCP tools.

The `?nativeSelfTest=1` harness uses Chrome's real `document.modelContext.getTools()` and `executeTool()` APIs. It proves native discovery, invocation, lifecycle changes, visible state synchronisation, and structured results. It is explicitly labelled and is **not** evidence that a language model selected the correct tool from natural language.

Native acceptance requires all of the following:

1. The target browser exposes `document.modelContext.registerTool`.
2. The page reports `Native WebMCP` and the agent discovers `inspect_incident`.
3. After human mandate activation, the agent discovers and invokes `shift_incident_traffic`.
4. The visible page changes to the stable 80/20 state and emits the corresponding receipt.
5. The reset-to-stable path succeeds five consecutive times through the real agent.

For local Chrome development, the official setup requires enabling `chrome://flags/#enable-webmcp-testing` and relaunching Chrome. The `#devtools-webmcp-support` flag additionally exposes WebMCP inspection in DevTools.
