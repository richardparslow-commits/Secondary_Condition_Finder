import { redirect } from "next/navigation";

/**
 * Legacy results route.
 *
 * Historical versions accepted health-related intake state through query
 * parameters. The supported workflow is now session-backed under /secondary,
 * so this route intentionally refuses to process legacy URL state.
 */
export default function ResultsPage() {
  redirect("/secondary");
}
