import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { buildTrustedTypesPolicyOptions, type TrustedTypePolicyOptions } from "../src/lib/security/trusted-types-policy";

const script = fs.readFileSync("public/trusted-types-bootstrap.js", "utf8");

function browser() {
  const policies: TrustedTypePolicyOptions[] = [];
  const attributes = new Map<string, string>();
  const factory = {
    defaultPolicy: null as TrustedTypePolicyOptions | null,
    createPolicy(name: string, options: TrustedTypePolicyOptions) {
      expect(name).toBe("default");
      policies.push(options);
      this.defaultPolicy = options;
      return options;
    },
  };
  const context = vm.createContext({
    URL,
    window: { trustedTypes: factory, location: { origin: "https://app.example", href: "https://app.example/secondary/diagnosed" } },
    document: { documentElement: { setAttribute: (key: string, value: string) => attributes.set(key, value) } },
  });
  return { context, factory, policies, attributes };
}

describe("parser-time Trusted Types bootstrap", () => {
  it("installs before any React mount and safely reuses the policy on repeat execution", () => {
    const b = browser();
    vm.runInContext(script, b.context);
    expect(b.factory.defaultPolicy).not.toBeNull();
    expect(b.attributes.get("data-tt-ready")).toBe("true");
    vm.runInContext(script, b.context);
    expect(b.policies).toHaveLength(1);
  });

  it("matches the existing policy's same-origin URL gate and rejects script/HTML bodies", () => {
    const b = browser();
    vm.runInContext(script, b.context);
    const fallback = buildTrustedTypesPolicyOptions({ origin: "https://app.example", href: "https://app.example/secondary/diagnosed" });
    for (const policy of [b.factory.defaultPolicy!, fallback]) {
      for (const allowed of ["/_next/static/chunks/app.js", "/tesseract/worker.min.js", "https://app.example/bootstrap.js"]) {
        expect(policy.createScriptURL!(allowed)).toBe(allowed);
      }
      for (const denied of ["https://evil.example/x.js", "//evil.example/x.js", "http://app.example/x.js", "blob:https://app.example/id", "data:text/javascript,alert(1)", "javascript:alert(1)", "http://["]) {
        expect(() => policy.createScriptURL!(denied)).toThrow();
      }
      expect(() => policy.createScript!("alert(1)")).toThrow();
      expect(() => policy.createHTML!("<img src=x onerror=alert(1)>")).toThrow();
    }
  });

  it("server-renders a nonce-authorized blocking head script before the hydration fallback", () => {
    const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain('(await headers()).get("x-nonce")');
    expect(layout).toContain('<script nonce={nonce} src="/trusted-types-bootstrap.js" />');
    expect(layout.indexOf('src="/trusted-types-bootstrap.js"')).toBeLessThan(layout.indexOf("<TrustedTypesGate />"));
  });
});
