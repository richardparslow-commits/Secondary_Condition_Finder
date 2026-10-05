import { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ jar: null as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => mock.jar }));

import { clearSecondaryWorkflowSession, readSecondaryWorkflowSession, writeSecondaryWorkflowSession } from "@/lib/secondary-workflow/session";
import { clearPresumptiveSession, readPresumptiveSession, writePresumptiveSession } from "@/lib/presumptive/session";

beforeEach(() => {
  vi.stubEnv("WORKFLOW_SESSION_SECRET", "synthetic-cookie-scope-test-secret-32-chars");
});

describe("workflow cookie removal uses the original path", () => {
  for (const track of [
    { name: "secondary-workflow-v2", path: "/secondary", write: () => writeSecondaryWorkflowSession({ diagnosedConditionIds: ["ptsd"] }), clear: clearSecondaryWorkflowSession, read: readSecondaryWorkflowSession, empty: {} },
    { name: "presumptive-workflow-v1", path: "/presumptive", write: () => writePresumptiveSession({ locations: ["Iraq"], serviceStart: null, serviceEnd: null }), clear: clearPresumptiveSession, read: readPresumptiveSession, empty: null },
  ]) {
    it(`removes ${track.path} from a path-aware browser jar before reload`, async () => {
      const response = new ResponseCookies(new Headers());
      mock.jar = response;
      await track.write();
      const stored = response.get(track.name)!;
      expect(stored.path).toBe(track.path);
      const browserJar = new Map([[`${stored.name}:${stored.path}`, stored.value]]);
      await track.clear();
      const tombstone = response.get(track.name)!;
      expect(tombstone.path).toBe(track.path);
      expect(new Date(tombstone.expires!).getTime()).toBe(0);
      browserJar.delete(`${tombstone.name}:${tombstone.path}`);
      expect(browserJar.size).toBe(0);
      mock.jar = { get: () => browserJar.has(`${track.name}:${track.path}`) ? { value: browserJar.get(`${track.name}:${track.path}`) } : undefined };
      expect(await track.read()).toEqual(track.empty);
    });
  }
});
