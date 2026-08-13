import type { ReactNode } from "react";

import { PresumptiveValidationQueryAlert } from "@/components/PresumptiveValidationQueryAlert";

export default function PresumptiveTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <PresumptiveValidationQueryAlert />
      {children}
    </>
  );
}
