import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { resourceFromAttributes } from '@opentelemetry/resources';

export const initTelemetry = () => {
  if (typeof window === 'undefined') return;

  // We route our traces to /v1/traces which will be proxied by Nginx to the internal OTel collector
  const exporter = new OTLPTraceExporter({
    url: `${window.location.origin}/v1/traces`,
  });

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'storesense-frontend',
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new UserInteractionInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [
          /.*storesense-ai\.local.*/,
          /.*localhost.*/,
        ],
      }),
    ],
  });

  console.log('OpenTelemetry Web instrumentation initialized');
};
