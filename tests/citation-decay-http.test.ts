import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashContent, probeUrlWithContent } from "../scripts/audit-citation-decay";

const article = "<html><body>Authoritative source fixture</body></html>";
let redirectCycleGetRequests = 0;
const server = createServer((req, res) => {
  if (req.method === "HEAD") { res.writeHead(200).end(); return; }
  switch (req.url) {
    case "/challenge": res.writeHead(203).end('<script>const challengeId = "fixture";</script>'); break;
    case "/redirect": res.writeHead(302, { location: "/article" }).end(); break;
    case "/redirect-cycle":
      redirectCycleGetRequests += 1;
      res.writeHead(302, { location: "/redirect-cycle" }).end();
      break;
    case "/missing": res.writeHead(404).end("Gone"); break;
    case "/huge": res.writeHead(200).end("x".repeat(2 * 1024 * 1024 + 1)); break;
    default: res.writeHead(200).end(article);
  }
});
let base = "";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

describe("citation-decay HTTP interface", () => {
  it("compares an actual GET body with the recorded digest", async () => {
    expect(await probeUrlWithContent(`${base}/article`, hashContent(article))).toMatchObject({ ok: true, drift: false, digestCompared: true });
  });
  it("does not credit a 203 challenge as source health or drift", async () => {
    expect(await probeUrlWithContent(`${base}/challenge`, hashContent(article))).toMatchObject({ ok: false, blocked: true, blockedReason: "non-authoritative-status" });
  });
  it("follows a GET redirect even after HEAD succeeded", async () => {
    expect(await probeUrlWithContent(`${base}/redirect`, null)).toMatchObject({ ok: true, status: 200, body: article });
  });
  it("stops following GET redirects after the redirect budget", async () => {
    redirectCycleGetRequests = 0;
    expect(await probeUrlWithContent(`${base}/redirect-cycle`, null)).toMatchObject({ ok: false, status: 302 });
    expect(redirectCycleGetRequests).toBe(6);
  });
  it("still flags real link rot", async () => {
    expect(await probeUrlWithContent(`${base}/missing`, null)).toMatchObject({ ok: false, status: 404 });
  });
  it("never compares a truncated body as though it were a complete source", async () => {
    const result = await probeUrlWithContent(`${base}/huge`, hashContent(article));
    expect(result).toMatchObject({ ok: false, blocked: true, blockedReason: "body-too-large" });
    expect(result).not.toHaveProperty("drift");
  });
});
