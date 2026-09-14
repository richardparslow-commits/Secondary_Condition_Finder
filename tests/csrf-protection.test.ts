import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateRequestOrigin } from "@/lib/security/csrf";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CSRF Origin/Referer validation", () => {
  describe("production mode", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_URL", "secondary-condition-finder.vercel.app");
    });

    it("accepts requests with matching Origin header", () => {
      const headers = new Headers({
        origin: "https://secondary-condition-finder.vercel.app",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(true);
    });

    it("rejects requests with mismatched Origin header", () => {
      const headers = new Headers({
        origin: "https://evil.example.com",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("origin-mismatch");
    });

    it("accepts requests with matching Referer header", () => {
      const headers = new Headers({
        referer: "https://secondary-condition-finder.vercel.app/secondary/diagnosed",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(true);
    });

    it("rejects requests with mismatched Referer header", () => {
      const headers = new Headers({
        referer: "https://evil.example.com/attack",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("referer-mismatch");
    });

    it("rejects invalid Origin header values", () => {
      const headers = new Headers({
        origin: "not-a-url",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("invalid-origin-header");
    });

    it("accepts requests with no Origin or Referer (e.g., server-to-server)", () => {
      const headers = new Headers();
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(true);
    });
  });

  describe("development mode", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("accepts localhost:3000 Origin", () => {
      const headers = new Headers({
        origin: "http://localhost:3000",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(true);
    });

    it("accepts localhost:3001 Origin", () => {
      const headers = new Headers({
        origin: "http://localhost:3001",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(true);
    });

    it("accepts 127.0.0.1:3000 Origin", () => {
      const headers = new Headers({
        origin: "http://127.0.0.1:3000",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(true);
    });

    it("rejects non-localhost Origin in development", () => {
      const headers = new Headers({
        origin: "https://evil.example.com",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("not-in-dev-allowlist");
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_URL", "secondary-condition-finder.vercel.app");
    });

    it("rejects non-http/https Origin schemes", () => {
      const headers = new Headers({
        origin: "file:///etc/passwd",
      });
      const result = validateRequestOrigin(headers);
      expect(result.ok).toBe(false);
    });

    it("accepts custom expectedOrigin override", () => {
      const headers = new Headers({
        origin: "https://custom.example.com",
      });
      const result = validateRequestOrigin(headers, "https://custom.example.com");
      expect(result.ok).toBe(true);
    });

    it("rejects when custom expectedOrigin does not match", () => {
      const headers = new Headers({
        origin: "https://other.example.com",
      });
      const result = validateRequestOrigin(headers, "https://custom.example.com");
      expect(result.ok).toBe(false);
    });
  });
});
