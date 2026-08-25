type MockToolRecord = {
  tool: WebMcpTool;
  controller?: AbortSignal;
};

class MockModelContext implements WebMcpModelContext {
  private tools = new Map<string, MockToolRecord>();

  async registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<void> {
    if (this.tools.has(tool.name)) {
      throw new DOMException(`Tool ${tool.name} is already registered.`, "InvalidStateError");
    }
    if (options?.signal?.aborted) {
      throw options.signal.reason;
    }
    this.tools.set(tool.name, { tool, controller: options?.signal });
    options?.signal?.addEventListener(
      "abort",
      () => {
        this.tools.delete(tool.name);
      },
      { once: true },
    );
  }

  async getTools(): Promise<WebMcpRegisteredTool[]> {
    return [...this.tools.values()].map(({ tool }) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      origin: window.location.origin,
      window,
    }));
  }

  listTools(): string[] {
    return [...this.tools.keys()].sort();
  }

  async execute(name: string, input: Record<string, unknown> = {}): Promise<unknown> {
    const record = this.tools.get(name);
    if (!record) throw new Error(`Mock WebMCP tool ${name} is not registered.`);
    return record.tool.execute(input, { signal: new AbortController().signal });
  }
}
export function installExplicitMockModelContext(): boolean {
  if (document.modelContext?.registerTool) return false;
  const requested = new URLSearchParams(window.location.search).get("mockWebMCP") === "1";
  if (!requested) return false;

  const mock = new MockModelContext();
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: mock,
  });
  window.__WEBMCP_DEV__ = {
    execute: (name, input) => mock.execute(name, input),
    listTools: () => mock.listTools(),
  };
  return true;
}
