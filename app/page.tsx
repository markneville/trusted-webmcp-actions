"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  activateMandate,
  approveFixReview,
  getIncidentState,
  getInitialIncidentState,
  rejectFixReview,
  resetIncident,
  revokeMandate,
  subscribeToIncident,
  type ActivityItem,
} from "@/lib/incident-store";
import { installExplicitMockModelContext } from "@/lib/mock-model-context";
import { registerIncidentTools, type WebMcpRuntime } from "@/lib/webmcp-tools";

const traceBefore = [2.1, 2.4, 2.9, 4.8, 8.7, 13.6];

function formatTimestamp(value: string | null): string {
  if (!value) return "Seeded · not yet acted on";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatExpiry(value: string | null): string {
  if (!value) return "Not issued";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function tracePoints(values: number[]): string {
  const max = 20;
  const width = 600;
  const height = 150;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function RuntimeBadge({ runtime }: { runtime: WebMcpRuntime | "connecting" }) {
  const labels: Record<typeof runtime, string> = {
    connecting: "Connecting",
    native: "Native WebMCP",
    mock: "Mock harness",
    unsupported: "WebMCP unavailable",
    error: "Registration error",
  };
  return <span className={`runtime-badge runtime-${runtime}`}>{labels[runtime]}</span>;
}

function DecisionTag({ decision }: { decision: ActivityItem["decision"] }) {
  return (
    <span className={`decision-tag decision-${decision}`}>
      {decision.replace("_", " ")}
    </span>
  );
}

function toolEffect(name: string): string {
  if (name === "inspect_incident") return "Read-only";
  if (name === "propose_checkout_fix_deploy") return "Stages review";
  if (name === "execute_approved_checkout_fix") return "One-time effect";
  return "State changing";
}

export default function Home() {
  const incident = useSyncExternalStore(
    subscribeToIncident,
    getIncidentState,
    getInitialIncidentState,
  );
  const [runtime, setRuntime] = useState<WebMcpRuntime | "connecting">("connecting");
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [mockResult, setMockResult] = useState<string | null>(null);
  const [nativeSelfTestEnabled, setNativeSelfTestEnabled] = useState(false);
  const [nativeResult, setNativeResult] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: () => void = () => undefined;
    let cancelled = false;
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      setNativeSelfTestEnabled(
        new URLSearchParams(window.location.search).get("nativeSelfTest") === "1",
      );
      const mockInstalled = installExplicitMockModelContext();

      void registerIncidentTools({
        mockInstalled,
        onToolsChanged: (names) => {
          if (!cancelled) setAvailableTools(names);
        },
        onRuntimeChanged: (nextRuntime, message) => {
          if (cancelled) return;
          setRuntime(nextRuntime);
          setRuntimeMessage(message ?? null);
        },
      }).then((dispose) => {
        if (cancelled) dispose();
        else cleanup = dispose;
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      cleanup();
    };
  }, []);

  const trace = useMemo(
    () => [...traceBefore, incident.errorRatePercent],
    [incident.errorRatePercent],
  );
  const remainingShift = Math.max(
    0,
    incident.mandate.maxShiftPercent - incident.mandate.usedShiftPercent,
  );
  const stable = incident.status === "stable";

  const runMockTool = async (
    name: string,
    input: Record<string, unknown> = {},
  ): Promise<void> => {
    try {
      const result = await window.__WEBMCP_DEV__?.execute(name, input);
      setMockResult(JSON.stringify(result ?? { error: "Mock tool did not return a result." }, null, 2));
    } catch (error) {
      setMockResult(
        JSON.stringify(
          { error: error instanceof Error ? error.message : "Unknown mock execution error." },
          null,
          2,
        ),
      );
    }
  };

  const runNativeTool = async (
    name: string,
    input: Record<string, unknown> = {},
  ): Promise<void> => {
    try {
      const context = document.modelContext;
      if (!context?.getTools || !context.executeTool) {
        throw new Error("This browser does not expose native WebMCP test execution.");
      }
      const tools = await context.getTools();
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Native WebMCP tool ${name} is not registered.`);
      const result = await context.executeTool(tool, JSON.stringify(input));
      let displayResult = result;
      if (typeof result === "string") {
        try {
          displayResult = JSON.parse(result);
        } catch {
          displayResult = result;
        }
      }
      setNativeResult(JSON.stringify(displayResult ?? null, null, 2));
    } catch (error) {
      setNativeResult(
        JSON.stringify(
          { error: error instanceof Error ? error.message : "Unknown native execution error." },
          null,
          2,
        ),
      );
    }
  };

  return (
    <main>
      <header className="site-header">
        <div>
          <a className="wordmark" href="#top" aria-label="Trusted WebMCP Actions home">
            <span aria-hidden="true" className="wordmark-mark">DGM</span>
            <span>Trusted WebMCP Actions</span>
          </a>
          <p className="eyebrow">Competition reference control room</p>
        </div>
        <div className="header-status" aria-live="polite">
          <RuntimeBadge runtime={runtime} />
          <span className="provenance-badge">Seeded reference state</span>
        </div>
      </header>

      <section id="top" className={`hero-status ${stable ? "hero-stable" : "hero-degraded"}`}>
        <div className="hero-copy">
          <p className="section-kicker">Incident {incident.scenarioId}</p>
          <div className="status-line">
            <span className="status-symbol" aria-hidden="true">{stable ? "✓" : "!"}</span>
            <div>
              <h1>{stable ? "Service stable" : "Action required"}</h1>
              <p>
                <strong>{incident.service}</strong> is {stable ? "within" : "outside"} the 5% error-rate threshold.
              </p>
            </div>
          </div>
        </div>
        <div className="hero-meta">
          <div>
            <span>Current state</span>
            <strong>{incident.status.toUpperCase()}</strong>
          </div>
          <div>
            <span>Freshness</span>
            <strong>{formatTimestamp(incident.updatedAt)}</strong>
          </div>
          <div>
            <span>Scope</span>
            <strong>This page only</strong>
          </div>
          <div>
            <span>Release</span>
            <strong>{incident.release.currentVersion}</strong>
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel health-panel" aria-labelledby="health-heading">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Live page state</p>
              <h2 id="health-heading">Service health</h2>
            </div>
            <span className={`status-pill ${stable ? "status-pill-stable" : "status-pill-degraded"}`}>
              {stable ? "Stable" : "Degraded"}
            </span>
          </div>

          <div className="metric-row">
            <div className="metric-primary">
              <span>Error rate</span>
              <strong>{incident.errorRatePercent.toFixed(1)}%</strong>
              <small>Stable at ≤ {incident.stableThresholdPercent}%</small>
            </div>
            <div className="metric-secondary">
              <span>p95 latency</span>
              <strong>{incident.p95LatencyMs} ms</strong>
              <small>Reference measurement</small>
            </div>
          </div>

          <figure className="health-trace">
            <svg
              viewBox="0 0 600 150"
              role="img"
              aria-label={`Reference error-rate trace ending at ${incident.errorRatePercent.toFixed(1)} percent.`}
            >
              <line x1="0" y1="112.5" x2="600" y2="112.5" className="threshold-line" />
              <polyline points={tracePoints(trace)} className="trace-line" />
              <circle
                cx="600"
                cy={150 - (incident.errorRatePercent / 20) * 150}
                r="6"
                className="trace-point"
              />
            </svg>
            <figcaption>
              Seeded error-rate trace · dashed line marks the 5% stability threshold.
            </figcaption>
          </figure>

          <div className="traffic-allocation" aria-label="Current traffic allocation">
            <div className="allocation-labels">
              <span>Primary {incident.traffic.primaryPercent}%</span>
              <span>Standby {incident.traffic.standbyPercent}%</span>
            </div>
            <div className="allocation-track">
              <span style={{ width: `${incident.traffic.primaryPercent}%` }} className="allocation-primary" />
              <span style={{ width: `${incident.traffic.standbyPercent}%` }} className="allocation-standby" />
            </div>
          </div>
        </section>

        <section className="panel authority-panel" aria-labelledby="authority-heading">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Human control</p>
              <h2 id="authority-heading">Delegated authority</h2>
            </div>
            <span className={`mandate-status mandate-${incident.mandate.status}`}>
              {incident.mandate.status.replace("_", " ")}
            </span>
          </div>

          <dl className="authority-list">
            <div><dt>Delegated to</dt><dd>Browser agent session · TWA-SESSION-01</dd></div>
            <div><dt>Resource</dt><dd>checkout-api</dd></div>
            <div><dt>Permitted action</dt><dd>Reversible traffic shift</dd></div>
            <div><dt>Cumulative limit</dt><dd>{incident.mandate.usedShiftPercent}% used · {remainingShift}% remaining</dd></div>
            <div><dt>Review boundary</dt><dd>Release change · approval once</dd></div>
            <div><dt>Expires</dt><dd>{formatExpiry(incident.mandate.expiresAt)}</dd></div>
          </dl>

          <div className="control-note">
            <strong>Governed path</strong>
            <p>
              Authority is bound to this reference browser-agent session. Release changes need
              an exact one-time human approval; no native ChatGPT identity is claimed.
            </p>
          </div>

          <div className="button-row">
            <button
              className="button button-primary"
              type="button"
              onClick={() => activateMandate()}
              disabled={incident.mandate.status === "active"}
            >
              Activate 15-minute mandate
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => revokeMandate()}
              disabled={incident.mandate.status !== "active"}
            >
              Revoke
            </button>
          </div>
        </section>

        <section className="panel tools-panel" aria-labelledby="tools-heading">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Current page capability</p>
              <h2 id="tools-heading">Agent tool surface</h2>
            </div>
            <span className="tool-count">{availableTools.length} available</span>
          </div>

          {runtimeMessage ? <p className="runtime-message" role="status">{runtimeMessage}</p> : null}
          {runtime === "mock" ? (
            <>
              <p className="mock-warning" role="note">
                Development harness only. This state is not native WebMCP acceptance evidence.
              </p>
              <div className="mock-controls" aria-label="Mock WebMCP execution controls">
                <div className="button-row">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => void runMockTool("inspect_incident")}
                  >
                    Run mock inspect
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={!availableTools.includes("shift_incident_traffic")}
                    onClick={() =>
                      void runMockTool("shift_incident_traffic", {
                        shiftPercent: 20,
                        reason: "Stabilise the seeded reference incident.",
                      })
                    }
                  >
                    Run mock 20% shift
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={!availableTools.includes("propose_checkout_fix_deploy")}
                    onClick={() =>
                      void runMockTool("propose_checkout_fix_deploy", {
                        proposedVersion: "checkout-2026.08.25.1",
                        reason: "Deploy the tested fix after the reversible incident mitigation.",
                      })
                    }
                  >
                    Run mock fix proposal
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={
                      !availableTools.includes("execute_approved_checkout_fix") ||
                      !incident.review.requestId
                    }
                    onClick={() =>
                      void runMockTool("execute_approved_checkout_fix", {
                        reviewRequestId: incident.review.requestId,
                      })
                    }
                  >
                    Run mock approved fix
                  </button>
                </div>
                {mockResult ? <pre aria-label="Latest mock tool result">{mockResult}</pre> : null}
              </div>
            </>
          ) : null}
          {runtime === "native" && nativeSelfTestEnabled ? (
            <>
              <p className="mock-warning" role="note">
                Native browser registry self-test. This proves real browser invocation, not model
                tool-selection accuracy.
              </p>
              <div className="mock-controls" aria-label="Native WebMCP self-test controls">
                <div className="button-row">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => void runNativeTool("inspect_incident")}
                  >
                    Run native inspect
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={!availableTools.includes("shift_incident_traffic")}
                    onClick={() =>
                      void runNativeTool("shift_incident_traffic", {
                        shiftPercent: 20,
                        reason: "Stabilise the seeded reference incident.",
                      })
                    }
                  >
                    Run native 20% shift
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={!availableTools.includes("propose_checkout_fix_deploy")}
                    onClick={() =>
                      void runNativeTool("propose_checkout_fix_deploy", {
                        proposedVersion: "checkout-2026.08.25.1",
                        reason: "Deploy the tested fix after the reversible incident mitigation.",
                      })
                    }
                  >
                    Run native fix proposal
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={
                      !availableTools.includes("execute_approved_checkout_fix") ||
                      !incident.review.requestId
                    }
                    onClick={() =>
                      void runNativeTool("execute_approved_checkout_fix", {
                        reviewRequestId: incident.review.requestId,
                      })
                    }
                  >
                    Run native approved fix
                  </button>
                </div>
                {nativeResult ? (
                  <pre aria-label="Latest native WebMCP result">{nativeResult}</pre>
                ) : null}
              </div>
            </>
          ) : null}
          <ul className="tool-list" aria-live="polite">
            {availableTools.length ? (
              availableTools.map((name) => (
                <li key={name}>
                  <span className="tool-dot" aria-hidden="true" />
                  <code>{name}</code>
                  <span>{toolEffect(name)}</span>
                </li>
              ))
            ) : (
              <li className="tool-empty">No native page tools are currently registered.</li>
            )}
          </ul>
        </section>

        <section
          className={`panel review-panel review-${incident.review.status}`}
          aria-labelledby="review-heading"
          aria-live="polite"
        >
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Agent → human → agent</p>
              <h2 id="review-heading">One-time release review</h2>
            </div>
            <span className={`review-status review-status-${incident.review.status}`}>
              {incident.review.status.replace("_", " ")}
            </span>
          </div>

          <div className="review-layout">
            <div className="review-copy">
              {incident.review.status === "not_requested" ? (
                <>
                  <strong>No proposal is waiting</strong>
                  <p>
                    The active mandate can stabilise traffic, but it cannot change the release.
                    The agent may stage an exact fix for human review without deploying it.
                  </p>
                  <code>
                    Propose checkout-2026.08.25.1 as the tested checkout-api fix.
                  </code>
                </>
              ) : (
                <>
                  <strong>
                    {incident.review.proposedVersion ?? "Reference release proposal"}
                  </strong>
                  <p>{incident.review.reason ?? "No proposal reason recorded."}</p>
                  <dl className="review-details">
                    <div><dt>Request</dt><dd>{incident.review.requestId ?? "Not issued"}</dd></div>
                    <div><dt>Requested by</dt><dd>Browser agent · TWA-SESSION-01</dd></div>
                    <div><dt>Current release</dt><dd>{incident.release.currentVersion}</dd></div>
                    <div><dt>Approval</dt><dd>{incident.review.approvalId ?? "Not granted"}</dd></div>
                  </dl>
                </>
              )}
            </div>

            <div className="review-control">
              {incident.review.status === "pending" ? (
                <>
                  <p>
                    <strong>Why review?</strong> A release change sits outside the reversible
                    traffic-shift mandate. Approval is bound to this request and expires in five
                    minutes.
                  </p>
                  <div className="button-row">
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => approveFixReview()}
                    >
                      Approve once
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => rejectFixReview()}
                    >
                      Reject
                    </button>
                  </div>
                </>
              ) : null}
              {incident.review.status === "approved" ? (
                <p>
                  <strong>Execution tool now available.</strong> It is bound to {incident.review.requestId},
                  expires at {formatExpiry(incident.review.approvalExpiresAt)}, and disappears after
                  one successful call.
                </p>
              ) : null}
              {incident.review.status === "executed" ? (
                <p>
                  <strong>Approval consumed.</strong> The visible reference release changed once;
                  replaying the request is denied and the execution tool is no longer exposed.
                </p>
              ) : null}
              {incident.review.status === "rejected" ? (
                <p><strong>Proposal rejected.</strong> No release state changed.</p>
              ) : null}
              {incident.review.status === "cancelled" ? (
                <p><strong>Review cancelled.</strong> Revocation or expiry removed the execution path.</p>
              ) : null}
              {incident.review.status === "not_requested" ? (
                <p>
                  <strong>WebMCP-native handoff.</strong> The proposal tool stages review; approval
                  dynamically exposes a separate, narrowly bound completion tool.
                </p>
              ) : null}
              <small>Reference page effect only · no external deployment or production system.</small>
            </div>
          </div>
        </section>

        <section className="panel activity-panel" aria-labelledby="activity-heading">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Decision evidence</p>
              <h2 id="activity-heading">Activity</h2>
            </div>
            <button className="text-button" type="button" onClick={() => resetIncident()}>
              Reset scenario
            </button>
          </div>

          <ol className="activity-list">
            {incident.activity.map((item) => (
              <li key={item.id}>
                <div className="activity-marker" aria-hidden="true" />
                <div className="activity-copy">
                  <div className="activity-title">
                    <strong>{item.title}</strong>
                    <DecisionTag decision={item.decision} />
                  </div>
                  <p>{item.detail}</p>
                  <div className="activity-meta">
                    <span className="activity-actor">{item.actor.replace("_", " ")}</span>
                    <span>{formatTimestamp(item.occurredAt)}</span>
                    {item.receiptId ? <code>{item.receiptId}</code> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer>
        <p><strong>Reference boundary:</strong> seeded scenario, real page-state mutation, no external infrastructure effect.</p>
        <a href="https://webmachinelearning.github.io/webmcp/" target="_blank" rel="noreferrer">WebMCP draft specification</a>
      </footer>
    </main>
  );
}
