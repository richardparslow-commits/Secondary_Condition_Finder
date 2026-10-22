import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSharp, optimizeImage } from "next/dist/server/image-optimizer/transform";

import {
  openSessionPayload,
  sealSessionPayload,
  WORKFLOW_SESSION_MAX_AGE_SECONDS,
} from "@/lib/workflow-session-crypto";

const TEST_SECRET = "test-remediation-workflow-secret-at-least-32-characters";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("security remediation contracts", () => {
  it("pins patched sharp and its platform binaries for GHSA-wq5f-xc86-pv6w", () => {
    const manifest = JSON.parse(read("package.json"));
    const lock = JSON.parse(read("package-lock.json")) as {
      packages: Record<string, {
        version?: string;
        optionalDependencies?: Record<string, string>;
      }>;
    };
    const patchedSharp = "0.35.5";

    expect(manifest.overrides.sharp).toBe(patchedSharp);
    expect(manifest.allowScripts[`sharp@${patchedSharp}`]).toBe(true);
    expect(lock.packages["node_modules/sharp"].version).toBe(patchedSharp);

    const binaries = Object.entries(lock.packages).filter(([name]) =>
      /(?:^|\/)node_modules\/@img\/sharp-/.test(name),
    );
    expect(binaries.length).toBeGreaterThan(0);
    for (const [name, entry] of binaries) {
      expect(entry.version, name).toBe(
        name.includes("/sharp-libvips-") ? "1.3.4" : patchedSharp,
      );
    }
    for (const [name, version] of Object.entries(
      lock.packages["node_modules/sharp"].optionalDependencies ?? {},
    )) {
      expect(lock.packages[`node_modules/${name}`]?.version, name).toBe(version);
    }
  });

  it("loads patched librsvg in the native sharp instance used by Next", () => {
    const sharp = getSharp(null, null);
    expect(sharp.versions.sharp).toBe("0.35.5");
    const rsvg = sharp.versions.rsvg;
    expect(rsvg).toMatch(/^\d+\.\d+\.\d+$/);
    if (!rsvg) throw new Error("Next's sharp instance must include patched librsvg");
    const installed = rsvg.split(".").map(Number);
    const minimum = [2, 63, 2];
    const difference = installed.findIndex((value, index) => value !== minimum[index]);
    expect(difference === -1 || installed[difference] > minimum[difference]).toBe(true);
  });

  it("rasterizes SVG and preserves PNG pixels through Next's native optimizer", async () => {
    const sharp = getSharp(null, null);
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="8">' +
      '<rect width="16" height="8" fill="#ff0000"/></svg>',
    );
    const png = await optimizeImage({
      buffer: svg,
      contentType: "image/png",
      quality: 100,
      width: 8,
    });
    expect(await sharp(png).metadata()).toMatchObject({
      format: "png", width: 8, height: 4,
    });
    const pixels = await sharp(png).removeAlpha().raw().toBuffer();
    expect(pixels).toEqual(Buffer.from(Array.from({ length: 32 }, () => [255, 0, 0]).flat()));

    const webp = await optimizeImage({
      buffer: png,
      contentType: "image/webp",
      quality: 100,
      width: 4,
    });
    expect(await sharp(webp).metadata()).toMatchObject({
      format: "webp", width: 4, height: 2,
    });
  });

  it("keeps the privileged Qwen issue automation disabled", () => {
    const workflow = read(".github/workflows/qwen-agent.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("issue_comment:");
    expect(workflow).not.toContain("issues:\n    types:");
    expect(workflow).not.toContain("QWEN_API_KEY");
    expect(workflow).not.toContain("QwenLM/qwen-code-action");
    expect(workflow).not.toContain("contents: write");
  });

  it("keeps broad CI failure issue auto-closure disabled", () => {
    const workflow = read(".github/workflows/ci-close-issues.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("workflow_run:");
    expect(workflow).not.toContain("issues: write");
    expect(workflow).not.toContain("gh issue close");
  });

  // The legacy secondary sealed-cookie budget cases were retired with the
  // cookie itself in PRIV-01 stage 3; the browser-local successors live in
  // tests/browser-local-budget-contract.test.ts and
  // tests/browser-local-persistence-failure-contract.test.ts.

  it("authenticates workflow-token lifetime and rejects replay after expiry", () => {
    const issuedAt = Date.UTC(2026, 7, 14, 3, 0, 0);
    const payload = { workflow: "secondary", step: 5 };
    const sealed = sealSessionPayload(payload, TEST_SECRET, {
      nowMs: issuedAt,
      maxAgeSeconds: WORKFLOW_SESSION_MAX_AGE_SECONDS,
    });

    expect(
      openSessionPayload(sealed, TEST_SECRET, {
        nowMs: issuedAt + WORKFLOW_SESSION_MAX_AGE_SECONDS * 1000 - 1,
      }),
    ).toEqual(payload);
    expect(
      openSessionPayload(sealed, TEST_SECRET, {
        nowMs: issuedAt + WORKFLOW_SESSION_MAX_AGE_SECONDS * 1000,
      }),
    ).toBeNull();
  });

  it("invalidates pre-expiry-format v1 workflow ciphertexts", () => {
    const fakeLegacyToken = [
      "v1",
      Buffer.alloc(12).toString("base64url"),
      Buffer.from("legacy").toString("base64url"),
      Buffer.alloc(16).toString("base64url"),
    ].join(".");

    expect(openSessionPayload(fakeLegacyToken, TEST_SECRET)).toBeNull();
  });
});
