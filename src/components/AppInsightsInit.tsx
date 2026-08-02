"use client";

import { useEffect } from "react";

import { initializeAppInsights } from "@/lib/appInsights";

export function AppInsightsInit() {
  useEffect(() => {
    void initializeAppInsights();
  }, []);

  return null;
}
