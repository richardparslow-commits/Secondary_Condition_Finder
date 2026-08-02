"use client";

import { useEffect } from "react";

export function AppInsightsInit() {
  useEffect(() => {
    let mounted = true;
    void import("@/lib/appInsights").then(({ createAppInsights }) => {
      if (mounted) createAppInsights();
    });
    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
