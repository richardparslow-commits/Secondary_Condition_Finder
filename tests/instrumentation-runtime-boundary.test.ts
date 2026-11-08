import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({
  embeddedImports: 0,
  install: vi.fn(),
  warmup: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.doMock("@/lib/data/embedded-bootstrap", () => {
    startup.embeddedImports += 1;
    return { installEmbeddedData: startup.install };
  });
  vi.doMock("@/lib/data/preload", () => ({ warmupDataCaches: startup.warmup }));
  startup.embeddedImports = 0;
  startup.install.mockReset();
  startup.warmup.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("instrumentation runtime boundaries", () => {
  it("does not load Node-only embedded bootstrap or filesystem warmup in Edge", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const { register } = await import("@/instrumentation");
    await register();
    expect(startup.embeddedImports).toBe(0);
    expect(startup.install).not.toHaveBeenCalled();
    expect(startup.warmup).not.toHaveBeenCalled();
  });

  it("keeps the embedded corpus out of ordinary Node startup", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubGlobal("navigator", { userAgent: "Node.js" });
    const { register } = await import("@/instrumentation");
    await register();
    expect(startup.embeddedImports).toBe(0);
    expect(startup.install).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(startup.warmup).toHaveBeenCalledOnce());
  });

  it("installs the embedded corpus before Workers registration completes", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    const { register } = await import("@/instrumentation");
    await register();
    expect(startup.embeddedImports).toBe(1);
    expect(startup.install).toHaveBeenCalledOnce();
    expect(startup.warmup).not.toHaveBeenCalled();
  });
});
