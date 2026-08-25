export type MandateStatus = "not_present" | "active" | "revoked" | "expired";
export type ServiceStatus = "degraded" | "stable";
export type Decision = "allowed" | "denied";

export type ActivityItem = {
  id: string;
  occurredAt: string | null;
  decision: Decision | "observed" | "control";
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
  mandate: {
    status: MandateStatus;
    maxShiftPercent: number;
    usedShiftPercent: number;
    issuedAt: string | null;
    expiresAt: string | null;
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
  authority: {
    status: MandateStatus;
    maxShiftPercent: number;
    usedShiftPercent: number;
    remainingShiftPercent: number;
    expiresAt: string | null;
  };
  recommendedBoundedAction: {
    tool: "shift_incident_traffic";
    shiftPercent: 20;
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
  mandate: {
    status: "not_present",
    maxShiftPercent: 25,
    usedShiftPercent: 0,
    issuedAt: null,
    expiresAt: null,
  },
  updatedAt: null,
  activity: [
    {
      id: "activity-seeded",
      occurredAt: null,
      decision: "observed",
      title: "Reference incident seeded",
      detail: "No external infrastructure or customer system is connected.",
    },
  ],
};

let state = structuredClone(INITIAL_STATE);
let receiptSequence = 0;
const listeners = new Set<() => void>();

function nowIso(at?: Date): string {
  return (at ?? new Date()).toISOString();
}
function nextReceiptId(): string {
  receiptSequence += 1;
  return `TWA-REF-${String(receiptSequence).padStart(4, "0")}`;
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
    updatedAt: occurredAt,
  };

  publish(
    withActivity(next, {
      id: `activity-revoked-${occurredAt}`,
      occurredAt,
      decision: "control",
      title: "Mandate revoked",
      detail: "Future governed tool calls are blocked; completed shifts are not reversed.",
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

  return {
    scenario: "seeded_reference_state",
    service: state.service,
    status: state.status,
    errorRatePercent: state.errorRatePercent,
    p95LatencyMs: state.p95LatencyMs,
    stableThresholdPercent: state.stableThresholdPercent,
    traffic: { ...state.traffic },
    authority: {
      status,
      maxShiftPercent: state.mandate.maxShiftPercent,
      usedShiftPercent: state.mandate.usedShiftPercent,
      remainingShiftPercent: Math.max(
        0,
        state.mandate.maxShiftPercent - state.mandate.usedShiftPercent,
      ),
      expiresAt: state.mandate.expiresAt,
    },
    recommendedBoundedAction: {
      tool: "shift_incident_traffic",
      shiftPercent: 20,
      rationale: "A 20% standby shift is reversible and remains within the reference mandate limit.",
    },
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
