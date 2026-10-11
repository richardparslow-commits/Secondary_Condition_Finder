import { afterEach, describe, expect, it, vi } from "vitest";

import { node } from "./helpers/pathway-fixtures";

/**
 * `/api/health` adjacency-graph component contracts.
 *
 * The graph loader is mocked here so the endpoint's aggregation is tested
 * independently of migration state: valid graph → counts surfaced; empty
 * graph → `ok` with zero counts (the pre-migration state is not a failure);
 * loader rejection → component error and a 503, because invalid adjacency
 * data is a deployed-integrity failure. The real loader's own validation
 * contracts live in `tests/kb-graph-loader.test.ts`.
 */

const mockLoadKbGraph = vi.fn();

vi.mock("@/lib/kb/graph", () => ({
  loadKbGraph: () => mockLoadKbGraph(),
}));

afterEach(() => {
  mockLoadKbGraph.mockReset();
});

async function health() {
  const { GET } = await import("@/app/api/health/route");
  const response = await GET();
  return { response, body: await response.json() };
}

describe("health endpoint adjacency-graph state", () => {
  it("reports nodes and edges for a migrated graph", async () => {
    mockLoadKbGraph.mockReturnValue(
      new Map([
        ["ptsd", node("ptsd", ["hypertension", 1])],
        ["hypertension", node("hypertension", ["sleep-apnea", 1])],
      ]),
    );

    const { response, body } = await health();
    expect(response.status).toBe(200);
    expect(body.components.kbGraph).toMatchObject({ status: "ok", nodes: 2, edges: 2 });
    expect(body.components.kbGraph.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("treats an empty graph as the valid pre-migration state", async () => {
    mockLoadKbGraph.mockReturnValue(new Map());

    const { response, body } = await health();
    expect(response.status).toBe(200);
    expect(body.components.kbGraph).toMatchObject({ status: "ok", nodes: 0, edges: 0 });
  });

  it("degrades to 503 on invalid graph data without exposing exception details", async () => {
    const sentinel = "SYNTHETIC-GRAPH-DIAGNOSTIC-SECRET";
    mockLoadKbGraph.mockImplementation(() => {
      throw new Error(`[kb-graph] Invalid node mapping in ${sentinel}: sensitive details`);
    });

    const { response, body } = await health();
    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.components.kbGraph).toMatchObject({
      status: "error",
      detail: "Knowledge graph validation failed.",
    });
    expect(body.components.catalog.status).toBe("ok");
    expect(JSON.stringify(body)).not.toContain(sentinel);
    expect(JSON.stringify(body)).not.toContain("sensitive details");
  });
});
