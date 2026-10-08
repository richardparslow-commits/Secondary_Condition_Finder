import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  findPrivateContextParameter,
  guardPrivateContextRequest,
  PRIVATE_CONTEXT_PARAMETER_NAMES,
  privateContextRefusalBody,
} from "@/lib/security/private-context-request-guard";
import { writeBrowserWorkflowContext } from "@/lib/secondary-workflow/browser-context";
import { ratingFieldName, timelineField } from "@/lib/secondary-workflow/state";
import { proxy } from "@/proxy";

/**
 * PRIV-01 request-refusal contract (contract accepted 2026-10-07).
 *
 * The browser-local boundary is only half the guarantee: the server must also
 * *refuse* a request that carries veteran health context, rather than answering
 * it while ignoring the fields. These cases drive the real edge proxy, so a
 * regression in the wiring fails here rather than in production.
 *
 * The refusal must never echo a value, and the parameter list must stay pinned
 * to the data model: the last two cases derive the vocabulary from the live
 * browser-local record schema and from the retired transport's own parsers, so
 * adding a private field without extending the guard fails the suite.
 */

const APP_ORIGIN = "http://127.0.0.1:3107";
const SENTINEL = "SENTINELPRIV01VALUE";

/** `/secondary` is the workflow area; every step page lives beneath it. */
const WORKFLOW_PATH = "/secondary/upload";

const RETIRED_FLAT_TRANSPORT_PARAMETERS = [
  "diagnosed",
  "serviceConnected",
  "documentsShared",
  "medications",
  "treatments",
  "history",
  "symptomIds",
];

const PER_CONDITION_PARAMETERS = [
  "rating-ptsd",
  "serviceConnected-ptsd",
  "onsetYear-ptsd",
  "diagnosisYear-ptsd",
];

/** `NextRequest`'s own init type — its `signal` is narrower than the DOM's. */
type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function workflowRequest(url: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(`${APP_ORIGIN}${url}`, init);
}

function refusalBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

/** Every field name a fully populated browser-local record can hold. */
function writtenRecordFieldNames(): string[] {
  let written: string | null = null;
  writeBrowserWorkflowContext(
    {
      setItem: (_key: string, value: string) => {
        written = value;
      },
    },
    {
      diagnosedConditionIds: ["ptsd"],
      serviceConnectedConditionIds: ["ptsd"],
      serviceConnectedAnswerDraft: { ptsd: "yes" },
      ratingsByConditionId: { ptsd: 70 },
      documentsShared: true,
      medications: ["synthetic medication"],
      treatments: ["synthetic treatment"],
      history: ["synthetic history"],
      symptomIds: ["nightmares"],
      conditionTimeline: { ptsd: { onsetYear: 2010, diagnosisYear: 2015 } },
    },
  );
  if (!written) throw new Error("the browser-local record was not written");
  return Object.keys(JSON.parse(written) as Record<string, unknown>);
}

describe("private context request guard (PRIV-01)", () => {
  it("refuses every retired flat transport parameter, on any path", async () => {
    for (const parameter of [
      ...RETIRED_FLAT_TRANSPORT_PARAMETERS,
      ...PER_CONDITION_PARAMETERS,
    ]) {
      for (const url of [
        `${WORKFLOW_PATH}?${parameter}=${SENTINEL}`,
        `/pathways?${parameter}=${SENTINEL}`,
      ]) {
        const response = proxy(workflowRequest(url));
        expect(response.status, `${url}`).toBe(400);
        const body = await refusalBody(response);
        expect(body.code, url).toBe("private-context-parameter");
        expect(body.parameter, url).toBe(parameter);
        // The refusal names the constant parameter; it must never carry the
        // value, which is the private part.
        expect(JSON.stringify(body), url).not.toContain(SENTINEL);
      }
    }
  });

  it("refuses the record's own field names as parameters", async () => {
    const fields = writtenRecordFieldNames();
    // Guard against a vacuous pass: the record must actually carry fields.
    expect(fields).toContain("diagnosedConditionIds");
    expect(fields.length).toBeGreaterThan(5);

    for (const field of fields) {
      if (field === "version") continue;
      const response = proxy(workflowRequest(`${WORKFLOW_PATH}?${field}=${SENTINEL}`));
      expect(response.status, field).toBe(400);
      expect((await refusalBody(response)).parameter, field).toBe(field);
    }
  });

  it("still clears a stale retired cookie when it refuses the request", () => {
    const request = new NextRequest(
      `${APP_ORIGIN}${WORKFLOW_PATH}?diagnosed=${SENTINEL}`,
      { headers: { cookie: "secondary-workflow-v2=sealed-legacy-state" } },
    );
    const response = proxy(request);

    expect(response.status).toBe(400);
    const tombstones = response.headers
      .getSetCookie()
      .filter((header) => header.startsWith("secondary-workflow-v2="));
    expect(tombstones).toHaveLength(2);
    for (const header of tombstones) {
      expect(header.toLowerCase()).toContain("max-age=0");
      expect(header.toLowerCase()).toContain("httponly");
    }
  });

  it("refuses write methods on workflow paths only", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = proxy(workflowRequest(WORKFLOW_PATH, { method }));
      expect(response.status, `workflow ${method}`).toBe(400);
      // Other tracks still POST their own Server Actions.
      const otherTrack = proxy(workflowRequest("/presumptive/results", { method }));
      expect(otherTrack.status, `presumptive ${method}`).toBe(200);
    }

    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const response = proxy(workflowRequest(WORKFLOW_PATH, { method }));
      expect(response.status, `workflow ${method}`).toBe(200);
    }
  });

  it("leaves every legitimate request shape alone", () => {
    const allowed = [
      "/secondary/diagnosed",
      "/secondary/suggestions?regSnapshot=reg-20261008T000000000Z-abc123",
      "/secondary/evidence?regSnapshot=reg-20261008T000000000Z-abc123&zip=20001&radiusMiles=50&type=representative",
      "/secondary/evidence?_rsc=1abc",
      "/va-forms/finder?q=21-526EZ",
      "/va-account?notice=signed-out",
      "/api/health",
      "/pathways",
    ];
    for (const url of allowed) {
      const response = proxy(workflowRequest(url));
      expect(response.status, url).toBe(200);
    }
  });

  it("covers every parameter the retired workflow parsers read", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/secondary-workflow/state.ts"),
      "utf8",
    );
    const exactNames = [
      ...new Set([...source.matchAll(/params\.([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1])),
    ];
    const prefixes = [
      ...new Set([...source.matchAll(/params\[`([A-Za-z]+)-/g)].map((m) => m[1])),
    ];

    // Non-vacuous: the parsers must still read something.
    expect(exactNames.length).toBeGreaterThan(0);
    expect(prefixes.length).toBeGreaterThan(0);

    for (const name of exactNames) {
      expect(findPrivateContextParameter([name]), name).not.toBeNull();
    }
    for (const prefix of prefixes) {
      expect(findPrivateContextParameter([`${prefix}-ptsd`]), prefix).not.toBeNull();
    }
    // `ratingFieldName` builds the per-condition rating family the same way.
    expect(findPrivateContextParameter([ratingFieldName("ptsd")])).not.toBeNull();
    expect(findPrivateContextParameter([timelineField("ptsd", "onsetYear")])).not.toBeNull();
    expect(findPrivateContextParameter([timelineField("ptsd", "diagnosisYear")])).not.toBeNull();
  });

  it("keeps the refusal decision total and value-free", () => {
    expect(guardPrivateContextRequest("GET", "/pathways", [])).toBeNull();
    expect(guardPrivateContextRequest("OPTIONS", "/secondary/diagnosed", [])).toBeNull();
    expect(guardPrivateContextRequest("POST", "/presumptive/results", [])).toBeNull();

    const refusal = guardPrivateContextRequest("GET", "/pathways", ["diagnosedConditionIds"]);
    expect(refusal).toEqual({
      status: 400,
      code: "private-context-parameter",
      parameter: "diagnosedConditionIds",
    });
    if (!refusal) throw new Error("expected a refusal");

    const body = privateContextRefusalBody(refusal);
    expect(body.parameter).toBe("diagnosedConditionIds");
    expect(JSON.stringify(body)).not.toContain(SENTINEL);
    // Only constants travel back: the body has exactly the declared keys.
    expect(Object.keys(body).sort()).toEqual(["code", "error", "parameter"]);
  });

  it("keeps the parameter list free of legitimate public parameters", () => {
    const publicParameters = [
      "regSnapshot",
      "zip",
      "radiusMiles",
      "type",
      "_rsc",
      "q",
      "notice",
      "prefix",
      "error",
    ];
    for (const name of publicParameters) {
      expect(PRIVATE_CONTEXT_PARAMETER_NAMES, name).not.toContain(name);
      expect(findPrivateContextParameter([name]), name).toBeNull();
    }
  });
});
