import {diag, DiagConsoleLogger, DiagLogLevel} from '@opentelemetry/api';
import {BatchSpanProcessor} from '@opentelemetry/sdk-trace-base';
import {NodeSDK} from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
import { detectResources } from '@opentelemetry/resources';

if (!process.env.OTEL_SERVICE_NAME || !process.env.OTEL_EXPORTER_OTLP_PROTOCOL ||
    !process.env.OTEL_EXPORTER_OTLP_ENDPOINT || ! process.env.OTEL_EXPORTER_OTLP_HEADERS) {
  console.log('NO CONFIG');
  console.dir(process.env);
  process.exit(-1);
}
diag.setLogger(
    new DiagConsoleLogger(),
    DiagLogLevel.ERROR
);

export async function setupTracing(): Promise<void> {
  if (!process.env.HONEYCOMB_API_KEY) {
     return Promise.reject(new Error('no honeycomb key'));
  } else {
    console.log("honeycomb key found");
  }
  
  // Create and assign the SDK instance
  const sdk  = new NodeSDK({
    traceExporter: new OTLPTraceExporter(), // traceExporter,
    autoDetectResources: true,
    // spanProcessors: [new BatchSpanProcessor(traceExporter)],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received: Shutting down telemetry...');
    await sdk.shutdown();
    console.log('Telemetry shutdown complete');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received: Shutting down telemetry...');
    await sdk.shutdown();
    console.log('Telemetry shutdown complete');
    process.exit(0);
  });
}
