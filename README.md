# Trusted WebMCP Actions

A clean-room competition reference app for delegated authority at a WebMCP action boundary.

This first vertical slice lets a browser agent inspect a seeded `checkout-api` incident and, only after a human activates a short-lived reference mandate, shift up to 25% of the page's traffic state to a standby route. The action updates the same live interface the human sees.

## Truth boundary

- Incident metrics are a **seeded reference scenario**, not external production telemetry.
- Traffic shifting is a real state change **inside this browser page**, not a cloud-provider integration.
- The reference policy demonstrates allowed and denied decisions on this governed path. It does not claim native agent identity, universal containment, or a production DGM Bridge deployment.
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

1. Open the app in ChatGPT's built-in browser with a model that supports site tools.
2. Confirm the page reports `Native WebMCP` and lists `inspect_incident`.
3. Ask: `Inspect the incident and tell me the safest bounded mitigation available.`
4. Activate the 15-minute mandate in the page.
5. Confirm `shift_incident_traffic` appears.
6. Ask: `Shift 20 percent of checkout-api traffic to standby to stabilise the incident.`
7. Confirm the service becomes stable, the allocation changes to 80/20, and an allowed activity receipt appears.
8. Revoke and reset; repeat five times.

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
