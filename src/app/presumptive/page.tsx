import Link from "next/link";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { ServiceHistoryForm } from "@/components/ServiceHistoryForm";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import { listLocations } from "@/lib/presumptive/match";

export default function PresumptivePage() {
  const locations = listLocations(loadExposureCatalog());

  return (
    <main>
      <Link href="/" className="text-sm underline hover:text-slate-900">
        Back to start
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Presumptive conditions by exposure
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          For some conditions, VA presumes your service caused them based on
          where and when you served. You do not need a nexus opinion or a
          related service-connected condition. This is a different and usually
          easier path than a secondary claim.
        </p>
      </header>

      <div
        role="note"
        className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
      >
        <p className="font-semibold">This is not an eligibility decision.</p>
        <p className="mt-1">
          This screen shows which presumptions may apply to your service. VA
          also considers your discharge characterization, your diagnosis, and
          evidence that can rebut a presumption. Confirm everything with an
          accredited representative or VSO.
        </p>
      </div>

      <ServiceHistoryForm locations={locations} />

      <DisclaimerFooter />
    </main>
  );
}
