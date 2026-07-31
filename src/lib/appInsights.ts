import { ApplicationInsights } from '@microsoft/applicationinsights-web';

export const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true, // Automatically track page route changes in Next.js
  },
});

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights.loadAppInsights();
  appInsights.trackPageView();
}
