// Parser-blocking bootstrap: the default policy must exist before framework
// chunks and imported libraries evaluate, not only after React hydration.
(function () {
  const factory = window.trustedTypes;
  if (!factory) return;
  if (!factory.defaultPolicy) {
    const origin = window.location.origin;
    const href = window.location.href;
    factory.createPolicy("default", {
      createScriptURL(input) {
        try {
          const url = new URL(input, href);
          if ((url.protocol === "https:" || url.protocol === "http:") && url.origin === origin) {
            return input;
          }
        } catch {}
        throw new Error("Trusted Types: refused non-same-origin script URL");
      },
      createScript() {
        throw new Error("Trusted Types: createScript is not permitted by the default policy");
      },
      createHTML() {
        throw new Error("Trusted Types: createHTML is not permitted by the default policy");
      },
    });
  }
  document.documentElement.setAttribute("data-tt-ready", "true");
})();
