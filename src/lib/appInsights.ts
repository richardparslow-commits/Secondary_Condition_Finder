let initialized = false;

export function sanitizeTelemetryUrl(rawUrl: string): string {
  try {
    const base = typeof window === "undefined" ? "https://local.invalid" : window.location.origin;
    const url = new URL(rawUrl, base);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl.split(/[?#]/, 1)[0];
  }
}

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
      enableAutoRouteTracking: false,
      disableAjaxTracking: true,
      disableFetchTracking: true,
    },
  });

  appInsights.addTelemetryInitializer((envelope) => {
    const baseData = envelope.baseData as
      | { uri?: string; refUri?: string; name?: string }
      | undefined;

    if (baseData?.uri) {
      baseData.uri = sanitizeTelemetryUrl(baseData.uri);
    }
    if (baseData?.refUri) {
      baseData.refUri = sanitizeTelemetryUrl(baseData.refUri);
    }

    return true;
  });

  appInsights.loadAppInsights();
  appInsights.trackPageView({
    name: window.location.pathname,
    uri: `${window.location.origin}${window.location.pathname}`,
  });
  initialized = true;
}

export function resetAppInsightsForTests(): void {
  initialized = false;
}
