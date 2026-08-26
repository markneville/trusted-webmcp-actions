import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateMandate,
  approveFixReview,
  getIncidentState,
  resetIncident,
  revokeMandate,
} from "@/lib/incident-store";
import { registerIncidentTools } from "@/lib/webmcp-tools";

class FakeModelContext {
  readonly tools = new Map<string, WebMcpTool>();

  async registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    this.tools.set(tool.name, tool);
    options?.signal?.addEventListener(
      "abort",
      () => this.tools.delete(tool.name),
      { once: true },
    );
  }

  async execute(name: string, input: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} is not registered.`);
    return tool.execute(input, { signal: new AbortController().signal });
  }
}

describe("state-aware WebMCP tool lifecycle", () => {
  beforeEach(() => resetIncident());

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  it("exposes a one-time execution tool only after exact human approval", async () => {
    const context = new FakeModelContext();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { modelContext: context },
    });
    let visibleNames: string[] = [];
    const dispose = await registerIncidentTools({
      mockInstalled: false,
      onToolsChanged: (names) => {
        visibleNames = names;
      },
      onRuntimeChanged: () => undefined,
    });

    expect(visibleNames).toEqual(["inspect_incident"]);

    activateMandate();
    await vi.waitFor(() =>
      expect(visibleNames).toEqual([
        "inspect_incident",
        "shift_incident_traffic",
      ]),
    );

    const mitigation = (await context.execute("shift_incident_traffic", {
      shiftPercent: 20,
      reason: "Stabilise the seeded incident before proposing the tested fix.",
    })) as { decision: string };
    expect(mitigation.decision).toBe("allowed");
    await vi.waitFor(() =>
      expect(visibleNames).toEqual([
        "inspect_incident",
        "propose_checkout_fix_deploy",
        "shift_incident_traffic",
      ]),
    );

    const proposal = (await context.execute("propose_checkout_fix_deploy", {
      proposedVersion: "checkout-2026.08.25.1",
      reason: "Deploy the tested reference fix after the reversible traffic shift.",
    })) as { decision: string; reviewRequestId: string };
    expect(proposal.decision).toBe("review_required");
    await vi.waitFor(() =>
      expect(visibleNames).toEqual(["inspect_incident", "shift_incident_traffic"]),
    );

    approveFixReview();
    await vi.waitFor(() =>
      expect(visibleNames).toEqual([
        "execute_approved_checkout_fix",
        "inspect_incident",
        "shift_incident_traffic",
      ]),
    );

    const execution = (await context.execute("execute_approved_checkout_fix", {
      reviewRequestId: proposal.reviewRequestId,
    })) as { decision: string; approvalConsumed: boolean };
    expect(execution).toMatchObject({ decision: "allowed", approvalConsumed: true });
    expect(getIncidentState().release.currentVersion).toBe("checkout-2026.08.25.1");
    await vi.waitFor(() =>
      expect(visibleNames).toEqual(["inspect_incident", "shift_incident_traffic"]),
    );

    revokeMandate();
    await vi.waitFor(() => expect(visibleNames).toEqual(["inspect_incident"]));

    dispose();
    expect(visibleNames).toEqual([]);
  });
});
