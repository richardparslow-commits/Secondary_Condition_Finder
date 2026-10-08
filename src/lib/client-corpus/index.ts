/**
 * Client-safe corpus surface (PRIV-01): the fetched public artifact plus the
 * React loader. Kept outside `src/lib/kb/` so client components can import it
 * without violating the composition audit's CLIENT-BOUNDARY rule.
 */
export * from "./client-corpus";
export * from "./use-client-corpus";
