import type { ReactNode } from "react";

import { SecondaryValidationQueryAlert } from "@/components/SecondaryValidationQueryAlert";

export default function UploadValidationLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SecondaryValidationQueryAlert controlName="documentsShared" />
      {children}
    </>
  );
}
