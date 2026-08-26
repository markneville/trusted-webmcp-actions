export type MandateStatus = "not_present" | "active" | "revoked" | "expired";
export type ServiceStatus = "degraded" | "stable";
export type Decision = "allowed" | "review_required" | "denied";
export type ActivityActor = "human" | "browser_agent" | "system";
export type ReviewStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "cancelled";

export type ActivityItem = {
  id: string;
  occurredAt: string | null;
  decision: Decision | "observed" | "control";
  actor: ActivityActor;
  title: string;
  detail: string;
  receiptId?: string;
};

export type IncidentState = {
  scenarioId: string;
  provenance: "seeded_reference_state";
  service: "checkout-api";
  status: ServiceStatus;
  errorRatePercent: number;
  p95LatencyMs: number;
  stableThresholdPercent: number;
  traffic: {
    primaryPercent: number;
    standbyPercent: number;
  };
  release: {
    currentVersion: string;
  };
  mandate: {
    status: MandateStatus;
    maxShiftPercent: number;
    usedShiftPercent: number;
    issuedAt: string | null;
    expiresAt: string | null;
  };
  review: {
    status: ReviewStatus;
    requestId: string | null;
    proposedVersion: string | null;
    reason: string | null;
    requestedAt: string | null;
    approvalId: string | null;
    approvedAt: string | null;
    approvalExpiresAt: string | null;
    consumedAt: string | null;
  };
  updatedAt: string | null;
  activity: ActivityItem[];
};

export type IncidentInspection = {
  scenario: "seeded_reference_state";
  service: string;
  status: ServiceStatus;
  errorRatePercent: number;
  p95LatencyMs: number;
  stableThresholdPercent: number;
  traffic: IncidentState["traffic"];
  release: IncidentState["release"];
  authority: {
    status: MandateStatus;
    maxShiftPercent: number;
    usedShiftPercent: number;
    remainingShiftPercent: number;
    expiresAt: string | null;
  };
  review: IncidentState["review"];
  recommendedAction: {
    tool:
      | "shift_incident_traffic"
      | "propose_checkout_fix_deploy"
      | "execute_approved_checkout_fix"
      | null;
    input: Record<string, string | number>;
    available: boolean;
    rationale: string;
  };
  caveat: string;
};

export type ShiftResult = {
  decision: Decision;
  receiptId: string;
  reason: string;
  service: string;
  requestedShiftPercent: number;
  traffic: IncidentState["traffic"];
  status: ServiceStatus;
  errorRatePercent: number;
  uiUpdated: boolean;
};

export type FixProposalResult = {
  decision: "review_required" | "denied";
  receiptId: string;
  reason: string;
  service: string;
  reviewRequestId: string | null;
  proposedVersion: string;
  currentVersion: string;
  uiUpdated: boolean;
};

export type FixExecutionResult = {
  decision: "allowed" | "denied";
  receiptId: string;
  reason: string;
  service: string;
  reviewRequestId: string;
  previousVersion: string;
  currentVersion: string;
  approvalConsumed: boolean;
  uiUpdated: boolean;
};

const INITIAL_STATE: IncidentState = {
  scenarioId: "TWA-INC-001",
  provenance: "seeded_reference_state",
  service: "checkout-api",
  status: "degraded",
  errorRatePercent: 18.4,
  p95LatencyMs: 920,
  stableThresholdPercent: 5,
  traffic: {
    primaryPercent: 100,
    standbyPercent: 0,
  },
  release: {
    currentVersion: "checkout-2026.08.24.3",
  },
  mandate: {
    status: "not_present",
    maxShiftPercent: 25,
    usedShiftPercent: 0,
    issuedAt: null,
    expiresAt: null,
  },
  review: {
    status: "not_requested",
    requestId: null,
    proposedVersion: null,
    reason: null,
    requestedAt: null,
    approvalId: null,
    approvedAt: null,
    approvalExpiresAt: null,
    consumedAt: null,
  },
  updatedAt: null,
  activity: [
    {
      id: "activity-seeded",
      occurredAt: null,
      decision: "observed",
      actor: "system",
      title: "Reference incident seeded",
      detail: "No external infrastructure or customer system is connected.",
    },
  ],
};

let state = structuredClone(INITIAL_STATE);
let receiptSequence = 0;
let reviewSequence = 0;
let approvalSequence = 0;
const listeners = new Set<() => void>();

function nowIso(at?: Date): string {
  return (at ?? new Date()).toISOString();
}
function nextReceiptId(): string {
  receiptSequence += 1;
  return `TWA-REF-${String(receiptSequence).padStart(4, "0")}`;
}

function nextReviewRequestId(): string {
  reviewSequence += 1;
  return `TWA-REVIEW-${String(reviewSequence).padStart(4, "0")}`;
}

function nextApprovalId(): string {
  approvalSequence += 1;
  return `TWA-APPROVAL-${String(approvalSequence).padStart(4, "0")}`;
}

function publish(next: IncidentState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function withActivity(next: IncidentState, item: ActivityItem): IncidentState {
  return {
    ...next,
    activity: [item, ...next.activity].slice(0, 8),
  };
}

export function getIncidentState(): IncidentState {
  return state;
}

export function getInitialIncidentState(): IncidentState {
  return INITIAL_STATE;
}

export function subscribeToIncident(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetIncident(): void {
  receiptSequence = 0;
  reviewSequence = 0;
  approvalSequence = 0;
  publish(structuredClone(INITIAL_STATE));
}

export function activateMandate(at?: Date): void {
  const occurredAt = nowIso(at);
  const expiresAt = new Date(new Date(occurredAt).getTime() + 15 * 60 * 1000).toISOString();
  const next: IncidentState = {
    ...state,
    mandate: {
      status: "active",
      maxShiftPercent: 25,
      usedShiftPercent: 0,
      issuedAt: occurredAt,
      expiresAt,
    },
    updatedAt: occurredAt,
  };

  publish(
    withActivity(next, {
      id: `activity-mandate-${occurredAt}`,
      occurredAt,
      decision: "control",
      actor: "human",
      title: "15-minute reference mandate activated",
      detail: "checkout-api only · reversible traffic shift · cumulative limit 25%.",
    }),
  );
}

export function revokeMandate(at?: Date): void {
  if (state.mandate.status !== "active") return;
  const occurredAt = nowIso(at);
  const next: IncidentState = {
    ...state,
    mandate: {
      ...state.mandate,
      status: "revoked",
    },
    review:
      state.review.status === "pending" || state.review.status === "approved"
        ? { ...state.review, status: "cancelled" }
        : state.review,
    updatedAt: occurredAt,
  };

  publish(
    withActivity(next, {
      id: `activity-revoked-${occurredAt}`,
      occurredAt,
      decision: "control",
      actor: "human",
      title: "Mandate revoked",
      detail:
        "Future governed tool calls are blocked; any open review or one-time approval is cancelled.",
    }),
  );
}

function effectiveMandateStatus(at: Date): MandateStatus {
  if (state.mandate.status !== "active" || !state.mandate.expiresAt) {
    return state.mandate.status;
  }
  return at.getTime() >= new Date(state.mandate.expiresAt).getTime() ? "expired" : "active";
}

export function inspectIncident(at?: Date): IncidentInspection {
  const observedAt = at ?? new Date();
  const status = effectiveMandateStatus(observedAt);
  if (status === "expired" && state.mandate.status === "active") {
    publish({
      ...state,
      mandate: { ...state.mandate, status: "expired" },
      updatedAt: observedAt.toISOString(),
    });
  }

  const remainingShiftPercent = Math.max(
    0,
    state.mandate.maxShiftPercent - state.mandate.usedShiftPercent,
  );
  let recommendedAction: IncidentInspection["recommendedAction"];
  if (state.status === "degraded" && remainingShiftPercent > 0) {
    const shiftPercent = Math.min(20, remainingShiftPercent);
    recommendedAction = {
      tool: "shift_incident_traffic",
      input: { shiftPercent },
      available: status === "active",
      rationale:
        status === "active"
          ? `A ${shiftPercent}% standby shift is reversible and remains within the reference mandate limit.`
          : `A ${shiftPercent}% standby shift is the safest bounded mitigation after a human activates the reference mandate.`,
    };
  } else if (status !== "active") {
    recommendedAction = {
      tool: null,
      input: {},
      available: false,
      rationale: `No governed action is available because the reference mandate is ${status.replace("_", " ")}.`,
    };
  } else if (
    state.review.status === "not_requested" ||
    state.review.status === "rejected"
  ) {
    recommendedAction = {
      tool: "propose_checkout_fix_deploy",
      input: {
        proposedVersion: "checkout-2026.08.25.1",
        reason: "Deploy the tested fix after the reversible incident mitigation.",
      },
      available: true,
      rationale: "The service is stable; stage the tested reference fix for exact human review without changing the release.",
    };
  } else if (
    state.review.status === "approved" &&
    state.review.requestId
  ) {
    recommendedAction = {
      tool: "execute_approved_checkout_fix",
      input: { reviewRequestId: state.review.requestId },
      available: true,
      rationale: "The exact review request has an active one-time human approval.",
    };
  } else {
    recommendedAction = {
      tool: null,
      input: {},
      available: false,
      rationale:
        state.review.status === "pending"
          ? "Wait for the human to approve or reject the exact release proposal."
          : "No further governed action is currently required.",
    };
  }

  return {
    scenario: "seeded_reference_state",
    service: state.service,
    status: state.status,
    errorRatePercent: state.errorRatePercent,
    p95LatencyMs: state.p95LatencyMs,
    stableThresholdPercent: state.stableThresholdPercent,
    traffic: { ...state.traffic },
    release: { ...state.release },
    authority: {
      status,
      maxShiftPercent: state.mandate.maxShiftPercent,
      usedShiftPercent: state.mandate.usedShiftPercent,
      remainingShiftPercent,
      expiresAt: state.mandate.expiresAt,
    },
    review: { ...state.review },
    recommendedAction,
    caveat: "This is seeded reference state, not external production telemetry.",
  };
}

export function shiftTraffic(
  shiftPercent: number,
  reason: string,
  at?: Date,
): ShiftResult {
  const occurredAt = at ?? new Date();
  const occurredAtIso = occurredAt.toISOString();
  const receiptId = nextReceiptId();
  const mandateStatus = effectiveMandateStatus(occurredAt);
  const validInteger = Number.isInteger(shiftPercent) && shiftPercent >= 1 && shiftPercent <= 25;
  const remaining = state.mandate.maxShiftPercent - state.mandate.usedShiftPercent;

  let denialReason: string | null = null;
  if (!validInteger) {
    denialReason = "Shift must be a whole number between 1 and 25 percent.";
  } else if (mandateStatus !== "active") {
    denialReason = `Reference mandate is ${mandateStatus.replace("_", " ")}.`;
  } else if (shiftPercent > remaining) {
    denialReason = `Requested ${shiftPercent}% exceeds the remaining cumulative allowance of ${remaining}%.`;
  }

  if (denialReason) {
    const next: IncidentState = {
      ...state,
      mandate:
        mandateStatus === "expired"
          ? { ...state.mandate, status: "expired" }
          : state.mandate,
      updatedAt: occurredAtIso,
    };
    publish(
      withActivity(next, {
        id: `activity-${receiptId}`,
        occurredAt: occurredAtIso,
        decision: "denied",
        actor: "browser_agent",
        title: "Traffic shift denied",
        detail: denialReason,
        receiptId,
      }),
    );
    return {
      decision: "denied",
      receiptId,
      reason: denialReason,
      service: state.service,
      requestedShiftPercent: shiftPercent,
      traffic: { ...state.traffic },
      status: state.status,
      errorRatePercent: state.errorRatePercent,
      uiUpdated: false,
    };
  }

  const standbyPercent = Math.min(100, state.traffic.standbyPercent + shiftPercent);
  const primaryPercent = 100 - standbyPercent;
  const errorRatePercent = Number(Math.max(2.4, 18.4 - standbyPercent * 0.76).toFixed(1));
  const p95LatencyMs = Math.round(Math.max(360, 920 - standbyPercent * 28));
  const serviceStatus: ServiceStatus =
    errorRatePercent <= state.stableThresholdPercent ? "stable" : "degraded";
  const detail = `${shiftPercent}% shifted to standby: ${reason.trim() || "No reason supplied."}`;
  const next: IncidentState = {
    ...state,
    status: serviceStatus,
    errorRatePercent,
    p95LatencyMs,
    traffic: { primaryPercent, standbyPercent },
    mandate: {
      ...state.mandate,
      usedShiftPercent: state.mandate.usedShiftPercent + shiftPercent,
    },
    updatedAt: occurredAtIso,
  };
  publish(
    withActivity(next, {
      id: `activity-${receiptId}`,
      occurredAt: occurredAtIso,
      decision: "allowed",
      actor: "browser_agent",
      title: "Bounded traffic shift allowed",
      detail,
      receiptId,
    }),
  );

  return {
    decision: "allowed",
    receiptId,
    reason: "Active mandate matched service, action, and cumulative limit.",
    service: state.service,
    requestedShiftPercent: shiftPercent,
    traffic: { ...state.traffic },
    status: state.status,
    errorRatePercent: state.errorRatePercent,
    uiUpdated: true,
  };
}

function validReleaseVersion(value: string): boolean {
  return /^checkout-\d{4}\.\d{2}\.\d{2}\.\d+$/.test(value);
}

export function proposeCheckoutFix(
  proposedVersion: string,
  reason: string,
  at?: Date,
): FixProposalResult {
  const occurredAt = at ?? new Date();
  const occurredAtIso = occurredAt.toISOString();
  const receiptId = nextReceiptId();
  const mandateStatus = effectiveMandateStatus(occurredAt);
  const trimmedVersion = proposedVersion.trim();
  const trimmedReason = reason.trim();

  let denialReason: string | null = null;
  if (mandateStatus !== "active") {
    denialReason = `Reference mandate is ${mandateStatus.replace("_", " ")}.`;
  } else if (state.status !== "stable") {
    denialReason = "Stabilise checkout-api before staging a release fix for review.";
  } else if (!validReleaseVersion(trimmedVersion)) {
    denialReason = "Version must match checkout-YYYY.MM.DD.N.";
  } else if (trimmedVersion === state.release.currentVersion) {
    denialReason = "Proposed version is already current.";
  } else if (trimmedReason.length < 12 || trimmedReason.length > 220) {
    denialReason = "Proposal reason must contain 12 to 220 characters.";
  } else if (state.review.status === "pending" || state.review.status === "approved") {
    denialReason = `Review request ${state.review.requestId} is already ${state.review.status}.`;
  } else if (state.review.status === "executed") {
    denialReason = "The one-time reference fix has already been executed.";
  }

  if (denialReason) {
    const next: IncidentState = {
      ...state,
      mandate:
        mandateStatus === "expired"
          ? { ...state.mandate, status: "expired" }
          : state.mandate,
      updatedAt: occurredAtIso,
    };
    publish(
      withActivity(next, {
        id: `activity-${receiptId}`,
        occurredAt: occurredAtIso,
        decision: "denied",
        actor: "browser_agent",
        title: "Fix proposal denied",
        detail: denialReason,
        receiptId,
      }),
    );
    return {
      decision: "denied",
      receiptId,
      reason: denialReason,
      service: state.service,
      reviewRequestId: null,
      proposedVersion: trimmedVersion,
      currentVersion: state.release.currentVersion,
      uiUpdated: false,
    };
  }

  const requestId = nextReviewRequestId();
  const next: IncidentState = {
    ...state,
    review: {
      status: "pending",
      requestId,
      proposedVersion: trimmedVersion,
      reason: trimmedReason,
      requestedAt: occurredAtIso,
      approvalId: null,
      approvedAt: null,
      approvalExpiresAt: null,
      consumedAt: null,
    },
    updatedAt: occurredAtIso,
  };
  publish(
    withActivity(next, {
      id: `activity-${receiptId}`,
      occurredAt: occurredAtIso,
      decision: "review_required",
      actor: "browser_agent",
      title: "Fix deployment needs human review",
      detail: `${trimmedVersion} proposed for checkout-api; no release state changed.`,
      receiptId,
    }),
  );

  return {
    decision: "review_required",
    receiptId,
    reason: "The active mandate permits reversible traffic shifts but requires one-time human review for a release change.",
    service: state.service,
    reviewRequestId: requestId,
    proposedVersion: trimmedVersion,
    currentVersion: state.release.currentVersion,
    uiUpdated: true,
  };
}

export function approveFixReview(at?: Date): boolean {
  if (state.mandate.status !== "active" || state.review.status !== "pending") return false;
  const occurredAt = nowIso(at);
  const approvalExpiresAt = new Date(new Date(occurredAt).getTime() + 5 * 60 * 1000).toISOString();
  const approvalId = nextApprovalId();
  const next: IncidentState = {
    ...state,
    review: {
      ...state.review,
      status: "approved",
      approvalId,
      approvedAt: occurredAt,
      approvalExpiresAt,
    },
    updatedAt: occurredAt,
  };
  publish(
    withActivity(next, {
      id: `activity-${approvalId}`,
      occurredAt,
      decision: "control",
      actor: "human",
      title: "One-time fix execution approved",
      detail: `${state.review.requestId} is approved for five minutes and bound to ${state.review.proposedVersion}.`,
    }),
  );
  return true;
}

export function rejectFixReview(at?: Date): boolean {
  if (state.review.status !== "pending") return false;
  const occurredAt = nowIso(at);
  const next: IncidentState = {
    ...state,
    review: { ...state.review, status: "rejected" },
    updatedAt: occurredAt,
  };
  publish(
    withActivity(next, {
      id: `activity-review-rejected-${occurredAt}`,
      occurredAt,
      decision: "control",
      actor: "human",
      title: "Fix proposal rejected",
      detail: `${state.review.requestId} cannot be executed; no release state changed.`,
    }),
  );
  return true;
}

export function executeApprovedCheckoutFix(
  reviewRequestId: string,
  at?: Date,
): FixExecutionResult {
  const occurredAt = at ?? new Date();
  const occurredAtIso = occurredAt.toISOString();
  const receiptId = nextReceiptId();
  const mandateStatus = effectiveMandateStatus(occurredAt);
  const previousVersion = state.release.currentVersion;
  const requestedId = reviewRequestId.trim();
  const approvalExpired =
    state.review.approvalExpiresAt !== null &&
    occurredAt.getTime() >= new Date(state.review.approvalExpiresAt).getTime();

  let denialReason: string | null = null;
  if (mandateStatus !== "active") {
    denialReason = `Reference mandate is ${mandateStatus.replace("_", " ")}.`;
  } else if (state.review.status !== "approved") {
    denialReason = `Review is ${state.review.status.replace("_", " ")}.`;
  } else if (requestedId !== state.review.requestId) {
    denialReason = "Review request ID does not match the approved request.";
  } else if (approvalExpired) {
    denialReason = "One-time approval has expired.";
  } else if (!state.review.proposedVersion) {
    denialReason = "Approved review has no bound release version.";
  }

  if (denialReason) {
    const next: IncidentState = {
      ...state,
      mandate:
        mandateStatus === "expired"
          ? { ...state.mandate, status: "expired" }
          : state.mandate,
      review:
        approvalExpired && state.review.status === "approved"
          ? { ...state.review, status: "cancelled" }
          : state.review,
      updatedAt: occurredAtIso,
    };
    publish(
      withActivity(next, {
        id: `activity-${receiptId}`,
        occurredAt: occurredAtIso,
        decision: "denied",
        actor: "browser_agent",
        title: "Fix execution denied",
        detail: denialReason,
        receiptId,
      }),
    );
    return {
      decision: "denied",
      receiptId,
      reason: denialReason,
      service: state.service,
      reviewRequestId: requestedId,
      previousVersion,
      currentVersion: state.release.currentVersion,
      approvalConsumed: false,
      uiUpdated: false,
    };
  }

  const currentVersion = state.review.proposedVersion as string;
  const next: IncidentState = {
    ...state,
    release: { currentVersion },
    review: {
      ...state.review,
      status: "executed",
      consumedAt: occurredAtIso,
    },
    updatedAt: occurredAtIso,
  };
  publish(
    withActivity(next, {
      id: `activity-${receiptId}`,
      occurredAt: occurredAtIso,
      decision: "allowed",
      actor: "browser_agent",
      title: "Approved reference fix executed",
      detail: `${previousVersion} → ${currentVersion}; one-time approval consumed.`,
      receiptId,
    }),
  );

  return {
    decision: "allowed",
    receiptId,
    reason: "Active mandate and exact unexpired one-time approval matched this review request.",
    service: state.service,
    reviewRequestId: requestedId,
    previousVersion,
    currentVersion,
    approvalConsumed: true,
    uiUpdated: true,
  };
}
