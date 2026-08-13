import type { Metadata } from "next";
import type { ReactNode } from "react";

import { RatingsFormValidationBridge } from "./RatingsFormValidationBridge";

export const metadata: Metadata = {
  title: "Disability Ratings | Secondary Condition Finder",
};

export default function RatingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RatingsFormValidationBridge />
      {children}
    </>
  );
}
