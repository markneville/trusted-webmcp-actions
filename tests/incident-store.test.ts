import { beforeEach, describe, expect, it } from "vitest";
import {
  activateMandate,
  getIncidentState,
  inspectIncident,
  resetIncident,
  revokeMandate,
  shiftTraffic,
} from "@/lib/incident-store";

const issuedAt = new Date("2026-08-25T18:00:00.000Z");

describe("reference incident authority boundary", () => {
  beforeEach(() => resetIncident());

  it("starts with a degraded seeded scenario and no authority", () => {
    const inspection = inspectIncident(issuedAt);
    expect(inspection.scenario).toBe("seeded_reference_state");
    expect(inspection.status).toBe("degraded");
    expect(inspection.authority.status).toBe("not_present");
    expect(inspection.recommendedBoundedAction.shiftPercent).toBe(20);
  });

  it("denies a shift without a mandate and preserves traffic state", () => {
    const result = shiftTraffic(20, "Stabilise the seeded incident.", issuedAt);
    expect(result.decision).toBe("denied");
    expect(result.uiUpdated).toBe(false);
    expect(getIncidentState().traffic).toEqual({ primaryPercent: 100, standbyPercent: 0 });
  });

  it("allows a bounded shift and updates the visible reference state", () => {
    activateMandate(issuedAt);
    const result = shiftTraffic(
      20,
      "Reduce checkout errors with a reversible standby shift.",
      new Date("2026-08-25T18:01:00.000Z"),
    );
    expect(result.decision).toBe("allowed");
    expect(result.uiUpdated).toBe(true);
    expect(result.traffic).toEqual({ primaryPercent: 80, standbyPercent: 20 });
    expect(result.status).toBe("stable");
    expect(result.errorRatePercent).toBeLessThanOrEqual(5);
  });

  it("enforces the cumulative 25 percent limit", () => {
    activateMandate(issuedAt);
    expect(shiftTraffic(20, "First bounded shift.", issuedAt).decision).toBe("allowed");
    const denied = shiftTraffic(6, "Attempt to exceed the remaining allowance.", issuedAt);
    expect(denied.decision).toBe("denied");
    expect(denied.reason).toContain("remaining cumulative allowance of 5%");
    expect(getIncidentState().traffic.standbyPercent).toBe(20);
  });

  it("blocks future actions after revocation without undoing completed effects", () => {
    activateMandate(issuedAt);
    expect(shiftTraffic(20, "Bounded mitigation.", issuedAt).decision).toBe("allowed");
    revokeMandate(new Date("2026-08-25T18:02:00.000Z"));
    const denied = shiftTraffic(
      5,
      "Continue after revocation.",
      new Date("2026-08-25T18:03:00.000Z"),
    );
    expect(denied.decision).toBe("denied");
    expect(denied.reason).toContain("revoked");
    expect(getIncidentState().traffic.standbyPercent).toBe(20);
  });

  it("expires authority at the 15-minute boundary", () => {
    activateMandate(issuedAt);
    const denied = shiftTraffic(
      20,
      "Attempt after expiry.",
      new Date("2026-08-25T18:15:00.000Z"),
    );
    expect(denied.decision).toBe("denied");
    expect(denied.reason).toContain("expired");
    expect(getIncidentState().mandate.status).toBe("expired");
  });

  it("rejects non-integer input even when authority is active", () => {
    activateMandate(issuedAt);
    const denied = shiftTraffic(2.5, "Invalid fractional shift.", issuedAt);
    expect(denied.decision).toBe("denied");
    expect(denied.reason).toContain("whole number");
  });
});
