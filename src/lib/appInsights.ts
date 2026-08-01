import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const connectionString = process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;
const isBrowser = typeof window !== 'undefined';

export const appInsights =
  isBrowser && connectionString
    ? new ApplicationInsights({
        config: {
          connectionString,
          enableAutoRouteTracking: true, // Automatically track page route changes in Next.js
        },
      })
    : null;

if (appInsights) {
  appInsights.loadAppInsights();
  appInsights.trackPageView();
}
