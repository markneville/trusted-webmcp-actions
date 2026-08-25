import {
  getIncidentState,
  inspectIncident,
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
  let shiftRegistrationPending = false;

  const publishTools = () => onToolsChanged([...registrations.keys()].sort());

  const addTool = async (tool: WebMcpTool): Promise<void> => {
    if (disposed || registrations.has(tool.name)) return;
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
    }
  };

  const removeTool = (name: string): void => {
    const registration = registrations.get(name);
    if (!registration) return;
    registration.controller.abort(`Tool ${name} is no longer available in this page state.`);
    registrations.delete(name);
    publishTools();
  };

  const syncAuthorityTool = async (): Promise<void> => {
    const active = getIncidentState().mandate.status === "active";
    if (active && !registrations.has(shiftTool.name) && !shiftRegistrationPending) {
      shiftRegistrationPending = true;
      await addTool(shiftTool);
      shiftRegistrationPending = false;
    } else if (!active) {
      removeTool(shiftTool.name);
    }
  };

  onRuntimeChanged(mockInstalled ? "mock" : "native");
  await addTool(inspectTool);
  await syncAuthorityTool();
  const unsubscribe = subscribeToIncident(() => {
    void syncAuthorityTool();
  });

  return () => {
    disposed = true;
    unsubscribe();
    registrations.forEach(({ controller }) => controller.abort("Page unmounted."));
    registrations.clear();
    publishTools();
  };
}
