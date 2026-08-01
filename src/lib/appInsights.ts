import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const connectionString = process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;

export function createAppInsights(): ApplicationInsights | null {
  if (!connectionString) return null;
  const instance = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,
    },
  });
  instance.loadAppInsights();
  instance.trackPageView();
  return instance;
}
