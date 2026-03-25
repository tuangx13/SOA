// tracing.js — OpenTelemetry Auto-instrumentation Setup
// File này phải được require() TRƯỚC TẤT CẢ các import khác

'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { ProbabilitySampler } = require('@opentelemetry/sdk-trace-node');

// Bật debug log để thấy traces đang được gửi
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const serviceName = process.env.OTEL_SERVICE_NAME || 'unknown-service';

// Custom Sampler để filter out health checks và static files
class FilterSampler {
  shouldSample(context, traceId, spanName, spanKind, attributes) {
    const httpTarget = attributes['http.target'] || '';
    const httpUrl = attributes['http.url'] || '';
    const path = httpTarget || httpUrl || '';

    // Bỏ qua /health checks và static files
    if (path === '/health' || /\.(js|css|html|ico|png|jpg|jpeg|gif|svg|woff|woff2)$/.test(path)) {
      return { decision: 0 }; // NOT_RECORD
    }

    // Log trace info cho business requests
    const httpMethod = attributes['http.method'] || '';
    console.log(`[TRACE] traceId=${traceId} path=${path} method=${httpMethod}`);

    return { decision: 2 }; // RECORD_AND_SAMPLE
  }

  toString() {
    return 'FilterSampler';
  }
}

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  }),
  traceExporter: new OTLPTraceExporter({
    // Jaeger OTLP HTTP endpoint (port 4318)
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
      : 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Tự động instrument Express, HTTP, Axios, và nhiều thư viện khác
      '@opentelemetry/instrumentation-fs': { enabled: false }, // Tắt fs để giảm noise
    }),
  ],
  sampler: new FilterSampler(),
});

sdk.start();
console.log(`[OpenTelemetry] Tracing initialized for service: ${serviceName}`);

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[OpenTelemetry] Tracing terminated'))
    .catch((error) => console.error('[OpenTelemetry] Error terminating tracing', error))
    .finally(() => process.exit(0));
});
