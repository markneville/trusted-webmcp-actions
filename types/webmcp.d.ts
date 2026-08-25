type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

type WebMcpExecuteOptions = {
  signal: AbortSignal;
};

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMcpToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    options: WebMcpExecuteOptions,
  ) => Promise<unknown>;
};

type WebMcpRegisteredTool = Omit<WebMcpTool, "execute"> & {
  origin?: string;
  window?: Window;
};

type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ) => Promise<void>;
  getTools?: (options?: { fromOrigins?: string[] }) => Promise<WebMcpRegisteredTool[]>;
};

interface Document {
  readonly modelContext?: WebMcpModelContext;
}
interface Window {
  __WEBMCP_DEV__?: {
    execute: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
    listTools: () => string[];
  };
}
