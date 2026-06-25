import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSentryStatus, captureError } from "@/lib/sentry";
import { getPostHogStatus, track } from "@/lib/analytics";

export default function ObservabilityCheck() {
  const [, refresh] = useState(0);
  const sentry = getSentryStatus();
  const posthog = getPostHogStatus();

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Observability Check</h1>
      <p className="text-sm text-muted-foreground">
        Internal diagnostic state only. Successful ingestion must be confirmed in the provider console.
      </p>
      <Card><CardHeader><CardTitle>Sentry</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
        <p>Configured: {String(sentry.configured)}</p>
        <p>Initialized: {String(sentry.initialized)}</p>
        <p>Environment: {sentry.environment}</p>
        <p>Release: {sentry.release}</p>
        <Button onClick={() => captureError(new Error("quantivis_observability_diagnostic"), { diagnostic: true })}>
          Send Sentry diagnostic
        </Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>PostHog</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
        <p>Configured: {String(posthog.configured)}</p>
        <p>Initialized: {String(posthog.initialized)}</p>
        <p>Loaded: {String(posthog.loaded)}</p>
        <p>Host: {posthog.host}</p>
        <p>Consent: {posthog.consent}</p>
        <div className="flex gap-2">
          <Button onClick={() => track("quantivis_observability_diagnostic", { diagnostic: true })}>
            Send PostHog diagnostic
          </Button>
          <Button variant="outline" onClick={() => refresh((value) => value + 1)}>Refresh state</Button>
        </div>
      </CardContent></Card>
    </main>
  );
}
