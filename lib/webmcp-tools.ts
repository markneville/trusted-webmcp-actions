import {
  executeApprovedCheckoutFix,
  getIncidentState,
  inspectIncident,
  proposeCheckoutFix,
  shiftTraffic,
  subscribeToIncident,
} from "@/lib/incident-store";

export type WebMcpRuntime = "native" | "mock" | "unsupported" | "error";

type RegistryCallbacks = {
  mockInstalled: boolean;
  onToolsChanged: (names: string[]) => void;
  onRuntimeChanged: (runtime: WebMcpRuntime, message?: string) => void;
};

type Registration = {
  name: string;
  controller: AbortController;
};

const inspectTool: WebMcpTool = {
  name: "inspect_incident",
  title: "Inspect incident",
  description:
    "Read the current seeded checkout-api incident, exact service metrics, traffic allocation, authority state, and the safest bounded mitigation. This tool does not change state.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: false,
  },
  execute: async () => inspectIncident(),
};

const shiftTool: WebMcpTool = {
  name: "shift_incident_traffic",
  title: "Shift incident traffic",
  description:
    "Immediately shift a whole-number percentage of checkout-api traffic from the primary route to standby. Use only for the seeded incident after inspecting it. The active reference mandate permits a cumulative maximum of 25 percent and the visible page updates after an allowed action.",
  inputSchema: {
    type: "object",
    properties: {
      shiftPercent: {
        type: "integer",
        minimum: 1,
        maximum: 25,
        description: "Whole percentage of traffic to move from primary to standby.",
      },
      reason: {
        type: "string",
        minLength: 8,
        maxLength: 180,
        description: "Short operational reason for the bounded traffic shift.",
      },
    },
    required: ["shiftPercent", "reason"],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: false,
    untrustedContentHint: false,
  },
  execute: async (input) => {
    const shiftPercent = Number(input.shiftPercent);
    const reason = typeof input.reason === "string" ? input.reason : "";
    return shiftTraffic(shiftPercent, reason);
  },
};

const proposeFixTool: WebMcpTool = {
  name: "propose_checkout_fix_deploy",
  title: "Propose checkout fix deployment",
  description:
    "Stage a checkout-api reference release for explicit human review after the incident is stabilised. This tool does not deploy the release or change the current version. It creates a visible review request and returns review_required with the exact reviewRequestId.",
  inputSchema: {
    type: "object",
    properties: {
      proposedVersion: {
        type: "string",
        pattern: "^checkout-[0-9]{4}\\.[0-9]{2}\\.[0-9]{2}\\.[0-9]+$",
        description: "Reference release identifier, for example checkout-2026.08.25.1.",
      },
      reason: {
        type: "string",
        minLength: 12,
        maxLength: 220,
        description: "Why this exact release should replace the current checkout-api version.",
      },
    },
    required: ["proposedVersion", "reason"],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: false,
    untrustedContentHint: false,
  },
  execute: async (input) => {
    const proposedVersion =
      typeof input.proposedVersion === "string" ? input.proposedVersion : "";
    const reason = typeof input.reason === "string" ? input.reason : "";
    return proposeCheckoutFix(proposedVersion, reason);
  },
};

function buildExecuteFixTool(
  reviewRequestId: string,
  proposedVersion: string,
): WebMcpTool {
  return {
    name: "execute_approved_checkout_fix",
    title: "Execute approved checkout fix",
    description:
      `Execute the exact one-time human-approved review ${reviewRequestId}, bound to ${proposedVersion}, and update the visible reference release. Use only after approval appears in the page. A successful call consumes the approval and removes this tool.`,
    inputSchema: {
      type: "object",
      properties: {
        reviewRequestId: {
          type: "string",
          const: reviewRequestId,
          description: "Exact review request ID returned by propose_checkout_fix_deploy.",
        },
      },
      required: ["reviewRequestId"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: false,
    },
    execute: async (input) => {
      const requestedId =
        typeof input.reviewRequestId === "string" ? input.reviewRequestId : "";
      return executeApprovedCheckoutFix(requestedId);
    },
  };
}

export async function registerIncidentTools({
  mockInstalled,
  onToolsChanged,
  onRuntimeChanged,
}: RegistryCallbacks): Promise<() => void> {
  const context = document.modelContext;
  if (!context?.registerTool) {
    onToolsChanged([]);
    onRuntimeChanged(
      "unsupported",
      "This browser does not expose document.modelContext.registerTool.",
    );
    return () => undefined;
  }

  const registrations = new Map<string, Registration>();
  let disposed = false;
  const pendingRegistrations = new Set<string>();

  const publishTools = () => onToolsChanged([...registrations.keys()].sort());

  const addTool = async (tool: WebMcpTool): Promise<void> => {
    if (disposed || registrations.has(tool.name) || pendingRegistrations.has(tool.name)) return;
    pendingRegistrations.add(tool.name);
    const controller = new AbortController();
    try {
      await context.registerTool(tool, { signal: controller.signal });
      if (disposed) {
        controller.abort("Page tool registry disposed.");
        return;
      }
      registrations.set(tool.name, { name: tool.name, controller });
      publishTools();
    } catch (error) {
      if (controller.signal.aborted || disposed) return;
      const message = error instanceof Error ? error.message : "Unknown WebMCP registration error.";
      onRuntimeChanged("error", message);
    } finally {
      pendingRegistrations.delete(tool.name);
    }
  };

  const removeTool = (name: string): void => {
    const registration = registrations.get(name);
    if (!registration) return;
    registration.controller.abort(`Tool ${name} is no longer available in this page state.`);
    registrations.delete(name);
    publishTools();
  };

  const syncAuthorityTools = async (): Promise<void> => {
    const incident = getIncidentState();
    const active = incident.mandate.status === "active";
    if (active) {
      await addTool(shiftTool);
    } else {
      removeTool(shiftTool.name);
    }

    const canPropose =
      active &&
      incident.status === "stable" &&
      incident.review.status !== "pending" &&
      incident.review.status !== "approved" &&
      incident.review.status !== "executed";
    if (canPropose) {
      await addTool(proposeFixTool);
    } else {
      removeTool(proposeFixTool.name);
    }

    if (
      active &&
      incident.review.status === "approved" &&
      incident.review.requestId &&
      incident.review.proposedVersion
    ) {
      await addTool(
        buildExecuteFixTool(incident.review.requestId, incident.review.proposedVersion),
      );
    } else {
      removeTool("execute_approved_checkout_fix");
    }
  };

  let authoritySync = Promise.resolve();
  let authoritySyncTimer: ReturnType<typeof setTimeout> | null = null;
  const queueAuthoritySync = (): Promise<void> => {
    authoritySync = authoritySync.then(syncAuthorityTools);
    return authoritySync;
  };
  const scheduleAuthoritySync = (): void => {
    if (authoritySyncTimer !== null) return;
    authoritySyncTimer = setTimeout(() => {
      authoritySyncTimer = null;
      void queueAuthoritySync();
    }, 0);
  };

  onRuntimeChanged(mockInstalled ? "mock" : "native");
  await addTool(inspectTool);
  const unsubscribe = subscribeToIncident(() => {
    scheduleAuthoritySync();
  });
  await queueAuthoritySync();

  return () => {
    disposed = true;
    unsubscribe();
    if (authoritySyncTimer !== null) clearTimeout(authoritySyncTimer);
    registrations.forEach(({ controller }) => controller.abort("Page unmounted."));
    registrations.clear();
    publishTools();
  };
}
