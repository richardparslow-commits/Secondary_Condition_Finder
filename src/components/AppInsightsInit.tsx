"use client";

import { useEffect } from "react";

import { createAppInsights } from "@/lib/appInsights";

export function AppInsightsInit() {
  useEffect(() => {
    createAppInsights();
  }, []);

  return null;
}
