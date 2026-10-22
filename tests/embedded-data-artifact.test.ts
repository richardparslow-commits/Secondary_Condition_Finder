import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The embedded artifact is what a Worker loads when it has no filesystem, so
 * the one property worth pinning is that it cannot drift from `data/`.
 *
 * `scripts/build-embedded-data.mjs` copies raw file text; this suite reads both
 * sides directly (no loader, no mocking) and requires every emitted string to
 * equal the current file byte-for-byte, every accepted file to be present, and
 * nothing the loaders would refuse — non-JSON entries, `_`-prefixed regulatory
 * files, the quarantine tree — to be emitted.
 */

const ARTIFACT = path.join(".data-bundle", "embedded-data.generated.json");

interface Artifact {
  version: number;
  domains: Record<string, Record<string, string>>;
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8")) as Artifact;

const DOMAINS = {
  catalog: ["data/conditions", (name: string) => name.endsWith(".json")],
  knowledgeBase: ["data/knowledge-base", (name: string) => name.endsWith(".json")],
  graph: ["data/knowledge-base/graph", (name: string) => name.endsWith(".json")],
  presumptives: ["data/presumptives", (name: string) => name.endsWith(".json")],
  regulatoryActions: [
    "data/regulatory-actions",
    (name: string) => name.endsWith(".json") && !name.startsWith("_"),
  ],
} as const;

describe("embedded data artifact", () => {
  it("declares the domain set the loaders read", () => {
    expect(artifact.version).toBe(1);
    expect(Object.keys(artifact.domains).sort()).toEqual(Object.keys(DOMAINS).sort());
  });

  it.each(Object.entries(DOMAINS))(
    "mirrors every accepted %s file byte-for-byte and emits nothing else",
    (domain, [directory, accept]) => {
      const files = artifact.domains[domain];
      const authored = fs
        .readdirSync(directory)
        .filter(accept)
        .sort();

      expect(Object.keys(files).sort()).toEqual(authored);
      for (const name of authored) {
        expect(files[name], name).toBe(fs.readFileSync(path.join(directory, name), "utf8"));
      }
    },
  );

  it("never embeds the retired quarantine tree or machine-local metadata", () => {
    const emitted = Object.values(artifact.domains).flatMap((files) => Object.keys(files));
    expect(emitted.some((name) => name.includes("knowledge-base-quarantine"))).toBe(false);
    expect(emitted.some((name) => name.startsWith(".") || name.includes(".DS_Store"))).toBe(false);

    const quarantined = fs.readdirSync("data/knowledge-base-quarantine");
    expect(quarantined.length).toBeGreaterThan(0);
  });
});
