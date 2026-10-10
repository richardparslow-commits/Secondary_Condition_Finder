import fs from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

/**
 * PRIV-01 stage 3 contract (2026-10-07).
 *
 * The legacy `secondary-workflow-v2` cookie is deleted from the codebase and
 * nothing may read it again. A browser that still presents a stale cookie is
 * answered with expired, path-scoped tombstones on both historical paths so
 * the stored veteran context is removed rather than kept.
 */

const COOKIE = "secondary-workflow-v2";

function requestWithCookie(value?: string): NextRequest {
  const headers = new Headers();
  if (value !== undefined) {
    headers.set("cookie", `${COOKIE}=${value}`);
  }
  return new NextRequest("http://127.0.0.1:3107/secondary/diagnosed", { headers });
}

function retiredSetCookieHeaders(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .filter((header) => header.startsWith(`${COOKIE}=`));
}

describe("retired secondary workflow cookie", () => {
  it("keeps no server-side session reader or writer in the repository", () => {
    expect(
      fs.existsSync(path.join(process.cwd(), "src/lib/secondary-workflow/session.ts")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(process.cwd(), "src/lib/secondary-workflow/cookie-encoding.ts")),
    ).toBe(false);
  });

  it("sends an expired tombstone on both historical cookie paths", () => {
    const response = proxy(requestWithCookie("sealed-legacy-state"));

    const tombstones = retiredSetCookieHeaders(response);
    expect(tombstones).toHaveLength(2);

    const byPath = new Map(
      tombstones.map((header) => {
        const pathMatch = /;\s*Path=([^;]+)/i.exec(header);
        return [pathMatch?.[1] ?? "", header] as const;
      }),
    );
    for (const cookiePath of ["/secondary", "/"]) {
      const header = byPath.get(cookiePath);
      expect(header, `tombstone for ${cookiePath}`).toBeDefined();
      if (!header) throw new Error(`missing tombstone for ${cookiePath}`);
      expect(header).toContain(`${COOKIE}=;`);
      expect(header.toLowerCase()).toContain("max-age=0");
      expect(header.toLowerCase()).toContain("httponly");
      expect(header.toLowerCase()).toContain("samesite=strict");
    }
  });

  it("adds no cookie header when the retired cookie is absent", () => {
    const response = proxy(requestWithCookie());
    expect(retiredSetCookieHeaders(response)).toHaveLength(0);
  });
});
