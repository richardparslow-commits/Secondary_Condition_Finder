let initialized = false;

export async function initializeAppInsights(): Promise<void> {
  if (initialized || typeof window === "undefined") {
    return;
  }

  const connectionString =
    process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    return;
  }

  const { ApplicationInsights } = await import(
    "@microsoft/applicationinsights-web"
  );

  const appInsights = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,
    },
  });

  appInsights.loadAppInsights();
  appInsights.trackPageView();
  initialized = true;
}

export function resetAppInsightsForTests(): void {
  initialized = false;
}
