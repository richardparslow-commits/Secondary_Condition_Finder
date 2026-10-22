import "server-only";

/**
 * Shape and process-wide handle of the build-time embedded data bundle.
 *
 * The bundle is installed once, at server startup, by
 * `embedded-bootstrap.ts` from a single string literal. It lives on
 * `globalThis` rather than in a module export on purpose: Turbopack inlines a
 * module's dependency graph into every route chunk that reaches it, so a JSON
 * import shared by four loaders was duplicated into eight server chunks and
 * took the Worker bundle from 14.5 MB to 80 MB. The instrumentation entry
 * imports the literal; loaders read the installed bundle here, which keeps one
 * copy in the deployment without turning the loaders into async fetches.
 *
 * A `Symbol.for` key (rather than a string name) keeps the object out of
 * enumerable globals and stable across duplicated module instances.
 */
export type EmbeddedDataDomain =
  | "catalog"
  | "knowledgeBase"
  | "graph"
  | "presumptives"
  | "regulatoryActions";

export interface EmbeddedDataBundle {
  version: number;
  domains: Record<EmbeddedDataDomain, Record<string, string>>;
}

export const EMBEDDED_DATA_GLOBAL_KEY = Symbol.for(
  "secondary-condition-finder.embedded-data",
);

/**
 * The installed bundle, or a fixed error.
 *
 * The message is deliberately content-free: a missing bundle means the runtime
 * chose the embedded path without the startup install running, and that is a
 * deployment wiring fact, not data to echo into a health response.
 */
export function readEmbeddedDataBundle(): EmbeddedDataBundle {
  const bundle = (globalThis as Record<symbol, unknown>)[EMBEDDED_DATA_GLOBAL_KEY];
  if (!bundle) {
    throw new Error("[data] Embedded knowledge data is not installed in this runtime.");
  }
  return bundle as EmbeddedDataBundle;
}
