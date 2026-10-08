import { RatingsStep } from "@/components/secondary/steps/RatingsStep";

export const dynamic = "force-dynamic";

// Uniform shell: no cookies or session reads; the client step owns all
// veteran context (PRIV-01 stage 2).
export default function RatingsPage() {
  return <RatingsStep />;
}
