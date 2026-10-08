import type { Metadata } from "next";

import { UploadStep } from "@/components/secondary/steps/UploadStep";

export const metadata: Metadata = {
  title: "Supporting Documents | Secondary Condition Finder",
};

// Uniform shell: no cookies or session reads; local evidence analysis and the
// bounded context form run entirely in the browser (PRIV-01 stage 2).
export const dynamic = "force-dynamic";

export default function UploadStepPage() {
  return <UploadStep />;
}
