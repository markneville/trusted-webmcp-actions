# Trusted WebMCP Actions

A clean-room competition reference app for delegated authority at a WebMCP action boundary.

This vertical slice lets a browser agent inspect a seeded `checkout-api` incident and, only after a human activates a short-lived reference mandate, shift up to 25% of the page's traffic state to a standby route. A release change sits outside that mandate: the agent can stage an exact proposal, the human can approve it once, and only then does a narrowly bound execution tool appear. Every allowed, review-required, and denied attempt updates the same live interface the human sees.

**Live demo:** [markneville.github.io/trusted-webmcp-actions](https://markneville.github.io/trusted-webmcp-actions/)

**Native registry check:** [open the labelled WebMCP self-test](https://markneville.github.io/trusted-webmcp-actions/?nativeSelfTest=1)

## Truth boundary

- Incident metrics are a **seeded reference scenario**, not external production telemetry.
- Traffic shifting is a real state change **inside this browser page**, not a cloud-provider integration.
- The reviewed release change is also a real state change **inside this browser page**, not an external deployment.
- The reference policy demonstrates allowed, review-required, and denied decisions on this governed path. It does not claim native agent identity, universal containment, or a production DGM Bridge deployment.
- `?mockWebMCP=1` is a visibly labelled developer harness. Only a native `document.modelContext` run counts as WebMCP acceptance evidence.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For visual and automated development in a browser without native WebMCP, use:

```text
http://localhost:3000/?mockWebMCP=1
```

## Native judge-path check

For local Chrome testing, enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome, as described in the [official Chrome WebMCP guide](https://developer.chrome.com/docs/ai/webmcp). The separate `chrome://flags/#devtools-webmcp-support` flag enables the experimental DevTools inspection panel but is not required by the page itself.

For a visibly labelled deterministic check through Chrome's real native registry, open:

```text
https://markneville.github.io/trusted-webmcp-actions/?nativeSelfTest=1
```

This uses `document.modelContext.getTools()` and `executeTool()` to invoke the registered callbacks. It proves native browser registration and execution, but it does not replace the Sol/Terra model-selection evaluation below.

1. Open the app in ChatGPT's built-in browser with a model that supports site tools.
2. Confirm the page reports `Native WebMCP` and lists `inspect_incident`.
3. Ask: `Inspect the incident and tell me the safest bounded mitigation available.`
4. Activate the 15-minute mandate in the page.
5. Confirm `shift_incident_traffic` appears while the release-proposal tool remains unavailable.
6. Ask: `Shift 20 percent of checkout-api traffic to standby to stabilise the incident.`
7. Confirm the service becomes stable, the allocation changes to 80/20, an allowed activity receipt appears, and `propose_checkout_fix_deploy` is registered.
8. Ask: `Propose checkout-2026.08.25.1 as the tested checkout-api fix.`
9. Confirm the page enters `review required` and the release has not changed.
10. Select `Approve once` in the page and confirm `execute_approved_checkout_fix` appears.
11. Ask: `Continue with the exact approved review request.`
12. Confirm the release changes once, the approval is consumed, and the execution tool disappears.
13. Revoke and reset; repeat five times.

## Why this is WebMCP-native

- The page exposes different capabilities to the human and agent at the same time.
- The registered tool surface follows live authority and review state.
- The proposal tool stages work but cannot complete it.
- Human approval creates a separate execution tool bound to one request and one release.
- Successful execution consumes the approval and unregisters that tool.
- Revocation removes every governed action tool while retaining read-only inspection.

Current validation receipts, including the distinction between deterministic mock proof and native acceptance, are recorded in [docs/vertical-slice-evidence.md](docs/vertical-slice-evidence.md).

## Quality gates

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Competition work

All implementation in this repository is being created during the WebMCP Challenge period beginning 25 August 2026. Dated Git history makes the competition-period work explicit; internal research and strategy notes remain outside the public source history.

## Licence

[MIT](LICENSE)
