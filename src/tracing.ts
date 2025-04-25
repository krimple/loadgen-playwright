import {diag, DiagConsoleLogger, DiagLogLevel} from '@opentelemetry/api';
import {BatchSpanProcessor} from '@opentelemetry/sdk-trace-base';
import {NodeSDK} from '@opentelemetry/sdk-node';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-proto';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
diag.setLogger(
    new DiagConsoleLogger(),
    DiagLogLevel.DEBUG
);
export async function setupTracing(): Promise<NodeSDK> {
  if (!process.env.HONEYCOMB_API_KEY) {
     return Promise.reject(new Error('no honeycomb key'));
  }
  const traceExporter = new OTLPTraceExporter({
    url: "https://api.honeycomb.io/v1/traces", // US instance
    headers: {
      'x-honeycomb-team': process.env.HONEYCOMB_API_KEY || 'your-api-key',
    },
  });

  const sdk: NodeSDK = new NodeSDK({
    spanProcessors: [new BatchSpanProcessor(traceExporter)],

    instrumentations: [
      getNodeAutoInstrumentations({
        // We recommend disabling fs automatic instrumentation because
        // it can be noisy and expensive during startup
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

  return Promise.resolve(sdk);
}
