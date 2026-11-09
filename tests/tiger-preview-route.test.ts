import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/tiger/preview-probe", () => ({
  probeTigerPreview: vi.fn().mockResolvedValue({ status: "connected_catalog_absent" }),
}));

import { GET } from "../src/app/api/internal/tiger-preview/route";
import { probeTigerPreview } from "../src/lib/tiger/preview-probe";

const originalPreview = process.env.VERCEL_ENV;
const originalToken = process.env.TIGER_PROBE_TOKEN;
const validToken = "p".repeat(48);
const request = (token?: string) => new Request("https://preview.example/api/internal/tiger-preview", {
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VERCEL_ENV = "preview";
  process.env.TIGER_PROBE_TOKEN = validToken;
});
afterEach(() => {
  if (originalPreview === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalPreview;
  if (originalToken === undefined) delete process.env.TIGER_PROBE_TOKEN;
  else process.env.TIGER_PROBE_TOKEN = originalToken;
});

describe("Tiger Preview-only route", () => {
  it("refuses all requests outside Preview", async () => {
    process.env.VERCEL_ENV = "production";
    expect((await GET(request(validToken))).status).toBe(404);
    expect(probeTigerPreview).not.toHaveBeenCalled();
  });
  it("refuses unauthorized requests before touching the database", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("wrong"))).status).toBe(401);
    expect(probeTigerPreview).not.toHaveBeenCalled();
  });
  it("reports absent catalog as incomplete, never as a success", async () => {
    const response = await GET(request(validToken));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "connected_catalog_absent" });
    expect(probeTigerPreview).toHaveBeenCalledOnce();
  });
});
