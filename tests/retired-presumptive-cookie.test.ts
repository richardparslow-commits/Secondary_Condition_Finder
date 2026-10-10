import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

/**
 * PRIV-01 follow-on (2026-10-08).
 *
 * The presumptive track's `presumptive-workflow-v1` cookie is retired with the
 * `saveServiceHistory` Server Action that wrote it: confirmed service
 * locations, branches and dates now live in the browser-local record
 * (`src/lib/presumptive/browser-history.ts`). No server module may read or
 * write the cookie again, and a browser that still presents a stale one is
 * answered with an expired, path-scoped tombstone so the stored service
 * history is removed rather than kept.
 */

const COOKIE = "presumptive-workflow-v1";

function requestWithCookie(value?: string): NextRequest {
  const headers = new Headers();
  if (value !== undefined) {
    headers.set("cookie", `${COOKIE}=${value}`);
  }
  return new NextRequest("http://127.0.0.1:3107/presumptive", { headers });
}

function retiredSetCookieHeaders(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(`${COOKIE}=`));
}

/**
 * Drops comments so the retirement record in `browser-history.ts` (which names
 * the cookie while explaining the migration) is not counted as a live reader.
 * String literals are preserved.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

describe("retired presumptive workflow cookie", () => {
  it("keeps no server-side session reader, writer or action in the repository", () => {
    for (const file of [
      "src/lib/presumptive/session.ts",
      "src/lib/actions/presumptive.ts",
      "src/lib/presumptive/cookie-encoding.ts",
    ]) {
      expect(fs.existsSync(path.join(process.cwd(), file)), file).toBe(false);
    }
  });

  it("mentions the retired cookie name only in the proxy tombstone", () => {
    const offenders = listSourceFiles(path.join(process.cwd(), "src"))
      .filter((file) => stripComments(fs.readFileSync(file, "utf8")).includes(COOKIE))
      .map((file) => path.relative(process.cwd(), file).split(path.sep).join("/"));

    expect(offenders).toEqual(["src/proxy.ts"]);
  });

  it("sends an expired tombstone on the historical cookie path", () => {
    const response = proxy(requestWithCookie("sealed-legacy-state"));

    const tombstones = retiredSetCookieHeaders(response);
    expect(tombstones).toHaveLength(1);

    const header = tombstones[0];
    expect(header).toContain(`${COOKIE}=;`);
    expect(header).toMatch(/;\s*Path=\/presumptive/i);
    expect(header.toLowerCase()).toContain("max-age=0");
    expect(header.toLowerCase()).toContain("httponly");
    expect(header.toLowerCase()).toContain("samesite=strict");
  });

  it("adds no cookie header when the retired cookie is absent", () => {
    const response = proxy(requestWithCookie());
    expect(retiredSetCookieHeaders(response)).toHaveLength(0);
  });
});
