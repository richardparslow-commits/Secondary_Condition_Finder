import type { Metadata } from "next";

import { ServiceConnectedStep } from "@/components/secondary/steps/ServiceConnectedStep";

export const metadata: Metadata = {
  title: "Service-Connected Conditions | Secondary Condition Finder",
};

// Uniform shell: no cookies or session reads; the client step owns all
// veteran context (PRIV-01 stage 2).
export const dynamic = "force-dynamic";

export default function ServiceConnectedStepPage() {
  return <ServiceConnectedStep />;
}
