import { beforeEach, describe, expect, it } from "vitest";
import {
  activateMandate,
  approveFixReview,
  executeApprovedCheckoutFix,
  getIncidentState,
  inspectIncident,
  proposeCheckoutFix,
  rejectFixReview,
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
    expect(inspection.recommendedAction).toMatchObject({
      tool: "shift_incident_traffic",
      input: { shiftPercent: 20 },
      available: false,
    });
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

  it("stages a release proposal for review without changing the current release", () => {
    activateMandate(issuedAt);
    shiftTraffic(20, "Stabilise before proposing the fix.", issuedAt);
    expect(inspectIncident(issuedAt).recommendedAction.tool).toBe(
      "propose_checkout_fix_deploy",
    );
    const result = proposeCheckoutFix(
      "checkout-2026.08.25.1",
      "Deploy the tested reference fix after the reversible traffic shift.",
      new Date("2026-08-25T18:02:00.000Z"),
    );

    expect(result.decision).toBe("review_required");
    expect(result.reviewRequestId).toBe("TWA-REVIEW-0001");
    expect(result.uiUpdated).toBe(true);
    expect(getIncidentState().review.status).toBe("pending");
    expect(getIncidentState().release.currentVersion).toBe("checkout-2026.08.24.3");
    expect(inspectIncident(new Date("2026-08-25T18:02:30.000Z")).recommendedAction.tool).toBeNull();
  });

  it("denies a release proposal until the reversible mitigation stabilises the service", () => {
    activateMandate(issuedAt);
    const denied = proposeCheckoutFix(
      "checkout-2026.08.25.1",
      "Deploy the tested reference fix after the reversible traffic shift.",
      new Date("2026-08-25T18:01:00.000Z"),
    );

    expect(denied.decision).toBe("denied");
    expect(denied.reason).toContain("Stabilise checkout-api");
    expect(getIncidentState().review.status).toBe("not_requested");
  });

  it("does not execute a review request before explicit human approval", () => {
    activateMandate(issuedAt);
    shiftTraffic(20, "Stabilise before proposing the fix.", issuedAt);
    const proposal = proposeCheckoutFix(
      "checkout-2026.08.25.1",
      "Deploy the tested reference fix after the reversible traffic shift.",
      new Date("2026-08-25T18:02:00.000Z"),
    );

    const denied = executeApprovedCheckoutFix(
      proposal.reviewRequestId!,
      new Date("2026-08-25T18:03:00.000Z"),
    );
    expect(denied.decision).toBe("denied");
    expect(denied.reason).toContain("pending");
    expect(denied.approvalConsumed).toBe(false);
    expect(getIncidentState().release.currentVersion).toBe("checkout-2026.08.24.3");
  });

  it("binds one-time approval to the exact review and prevents replay", () => {
    activateMandate(issuedAt);
    shiftTraffic(20, "Stabilise before proposing the fix.", issuedAt);
    const proposal = proposeCheckoutFix(
      "checkout-2026.08.25.1",
      "Deploy the tested reference fix after the reversible traffic shift.",
      new Date("2026-08-25T18:02:00.000Z"),
    );
    expect(approveFixReview(new Date("2026-08-25T18:03:00.000Z"))).toBe(true);
    expect(
      inspectIncident(new Date("2026-08-25T18:03:30.000Z")).recommendedAction,
    ).toMatchObject({
      tool: "execute_approved_checkout_fix",
      input: { reviewRequestId: proposal.reviewRequestId },
      available: true,
    });

    const wrongReview = executeApprovedCheckoutFix(
      "TWA-REVIEW-9999",
      new Date("2026-08-25T18:04:00.000Z"),
    );
    expect(wrongReview.decision).toBe("denied");
    expect(getIncidentState().review.status).toBe("approved");

    const allowed = executeApprovedCheckoutFix(
      proposal.reviewRequestId!,
      new Date("2026-08-25T18:04:30.000Z"),
    );
    expect(allowed.decision).toBe("allowed");
    expect(allowed.approvalConsumed).toBe(true);
    expect(getIncidentState().release.currentVersion).toBe("checkout-2026.08.25.1");
    expect(getIncidentState().review.status).toBe("executed");

    const replay = executeApprovedCheckoutFix(
      proposal.reviewRequestId!,
      new Date("2026-08-25T18:05:00.000Z"),
    );
    expect(replay.decision).toBe("denied");
    expect(replay.reason).toContain("executed");
  });

  it("expires a one-time approval after five minutes", () => {
    activateMandate(issuedAt);
    shiftTraffic(20, "Stabilise before proposing the fix.", issuedAt);
    const proposal = proposeCheckoutFix(
      "checkout-2026.08.25.1",
      "Deploy the tested reference fix after the reversible traffic shift.",
      new Date("2026-08-25T18:02:00.000Z"),
    );
    approveFixReview(new Date("2026-08-25T18:03:00.000Z"));

    const denied = executeApprovedCheckoutFix(
      proposal.reviewRequestId!,
      new Date("2026-08-25T18:08:00.000Z"),
    );
    expect(denied.decision).toBe("denied");
    expect(denied.reason).toContain("expired");
    expect(getIncidentState().review.status).toBe("cancelled");
  });

  it("cancels an approved request when the mandate is revoked", () => {
    activateMandate(issuedAt);
    shiftTraffic(20, "Stabilise before proposing the fix.", issuedAt);
    const proposal = proposeCheckoutFix(
      "checkout-2026.08.25.1",
      "Deploy the tested reference fix after the reversible traffic shift.",
      new Date("2026-08-25T18:02:00.000Z"),
    );
    approveFixReview(new Date("2026-08-25T18:03:00.000Z"));
    revokeMandate(new Date("2026-08-25T18:04:00.000Z"));

    expect(getIncidentState().review.status).toBe("cancelled");
    const denied = executeApprovedCheckoutFix(
      proposal.reviewRequestId!,
      new Date("2026-08-25T18:05:00.000Z"),
    );
    expect(denied.decision).toBe("denied");
    expect(denied.reason).toContain("revoked");
  });

  it("allows the human to reject a pending proposal without side effects", () => {
    activateMandate(issuedAt);
    shiftTraffic(20, "Stabilise before proposing the fix.", issuedAt);
    proposeCheckoutFix(
      "checkout-2026.08.25.1",
      "Deploy the tested reference fix after the reversible traffic shift.",
      new Date("2026-08-25T18:02:00.000Z"),
    );

    expect(rejectFixReview(new Date("2026-08-25T18:03:00.000Z"))).toBe(true);
    expect(getIncidentState().review.status).toBe("rejected");
    expect(getIncidentState().release.currentVersion).toBe("checkout-2026.08.24.3");
  });
});
