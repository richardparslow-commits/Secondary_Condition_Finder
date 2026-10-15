import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PUBLIC_ROUTES,
  ROOT_LAYOUT,
  effectiveTitle,
  manifestProblems,
  publishedTitle,
  titleChain,
} from "../scripts/lib/public-routes.mjs";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

/**
 * Document titles for every shipped route.
 *
 * The route list *and* the expected titles come from
 * `scripts/lib/public-routes.mjs`; this suite used to carry its own list, which
 * named 17 of the 26 reviewed routes. A page added to `src/app` with no title,
 * or with a title nobody declared, was therefore outside the check that exists
 * to catch exactly that. Now the inventory parity assertions below fail on an
 * undeclared page, and every declared route is checked.
 *
 * Each route's title is also resolved from disk rather than trusted: the
 * nearest `title:` in the page-then-layout chain is what a browser tab shows, so
 * if a page grows its own metadata the effective owner moves and the manifest
 * has to be updated in the same change.
 */
describe("shipped route document titles", () => {
  it("keeps the home title descriptive without adding a redundant suffix", () => {
    const source = read(ROOT_LAYOUT);
    expect(source).toContain('title: "Secondary Condition Finder"');
  });

  it("declares exactly the pages that ship, so no route escapes these checks", () => {
    expect(manifestProblems()).toEqual([]);
  });

  it.each(PUBLIC_ROUTES)("publishes the declared title for $path from $titleOwner", (entry) => {
    const published = publishedTitle(entry.titleOwner);
    expect(published, `${entry.titleOwner} publishes no title`).not.toBeNull();
    expect(published).toBe(entry.title);
  });

  it.each(PUBLIC_ROUTES)("resolves $titleOwner as the effective title for $path", (entry) => {
    const effective = effectiveTitle(entry);
    expect(effective, `${entry.path} resolves no title at all`).not.toBeNull();
    expect(effective).toEqual({ owner: entry.titleOwner, title: entry.title });
  });

  it("titles every reviewed route from the route itself or an explicit route-group layout", () => {
    // The two exemptions are the home route (whose title legitimately is the
    // application shell title) and the excluded redirect shim. Anything else
    // inheriting only `src/app/layout.tsx` would land in a browser tab reading
    // the site name and nothing about the page.
    const exempt = new Set(["/", "/results"]);
    for (const entry of PUBLIC_ROUTES) {
      if (exempt.has(entry.path)) continue;
      expect(
        entry.titleOwner,
        `${entry.path} would inherit only the root layout's site-name title`,
      ).not.toBe(ROOT_LAYOUT);
    }
  });

  it("keeps the resolved title chain nearest-first, ending at the root layout", () => {
    expect(titleChain("src/app/secondary/evidence/page.tsx")).toEqual([
      "src/app/secondary/evidence/page.tsx",
      "src/app/secondary/evidence/layout.tsx",
      "src/app/secondary/layout.tsx",
      "src/app/layout.tsx",
    ]);
  });
});
