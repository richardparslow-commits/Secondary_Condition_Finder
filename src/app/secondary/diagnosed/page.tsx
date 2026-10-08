import type { Metadata } from "next";

import { DiagnosedStep } from "@/components/secondary/steps/DiagnosedStep";

export const metadata: Metadata = {
  title: "Diagnosed Conditions | Secondary Condition Finder",
};

// The shell renders a uniform page: no cookies, no session reads, no veteran
// context. All workflow state is read and written in the browser by the client
// step (PRIV-01 stage 2).
export const dynamic = "force-dynamic";

export default function DiagnosedConditionsPage() {
  return <DiagnosedStep />;
}
