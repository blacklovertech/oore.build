# OpenTelemetry and Prometheus Observability

## Status

`ready`

## Problem

The oore.build platform contract (section 10) mandates observability via `tracing`, OpenTelemetry, and Prometheus metrics for the `oored` daemon. Without structured telemetry, operators have no way to monitor request throughput, latency, or trace distributed operations across the system. This feature implements the observability stack required by the V1 contract.

## User Impact

Operators running self-hosted `oored` instances benefit from:

- **Prometheus scraping**: a `/metrics` endpoint exposes request count (`http_requests_total`) and latency histogram (`http_request_duration_seconds`) labeled by HTTP method, route pattern, and status code. Any Prometheus-compatible monitoring stack can scrape this endpoint.
- **OpenTelemetry tracing (opt-in)**: when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, all `tracing` spans produced by the daemon are exported via OTLP/gRPC to a collector (e.g., Jaeger, Grafana Tempo). When the env var is unset the daemon starts without the OTel layer, incurring zero overhead.

No changes are required for existing deployments. The `/metrics` endpoint is always available and lightweight. OTel export is strictly opt-in.

## UI Changes

None. This is a backend-only observability feature.

## API Changes

- `GET /metrics` -- Returns Prometheus text exposition format. Always available, not gated behind auth. Contains `http_requests_total` counter and `http_request_duration_seconds` histogram with labels `method`, `path`, and `status`.

No existing endpoints are changed. The `/metrics` endpoint is additive.

## Security Considerations

- The `/metrics` endpoint exposes operational telemetry (request counts, latencies, route names). It does not expose user data, secrets, or authentication tokens.
- In production, operators should restrict access to `/metrics` via network policy or a reverse proxy if the scrape endpoint should not be publicly reachable.
- The OTel OTLP exporter sends spans to whatever endpoint `OTEL_EXPORTER_OTLP_ENDPOINT` points to. Operators are responsible for securing the collector endpoint (TLS, authentication).
- No new secrets or credentials are stored by this feature.

## Migration and Rollout

First implementation. No migration steps required. The feature is additive:

- The Prometheus `/metrics` endpoint is available immediately on daemon start.
- OTel tracing is activated only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Removing the env var reverts to fmt-only tracing.

## Acceptance Criteria

- [x] `GET /metrics` returns Prometheus text format with `http_requests_total` and `http_request_duration_seconds`
- [x] Metrics are labeled by `method`, `path` (matched route pattern), and `status`
- [x] OTel tracing layer is installed when `OTEL_EXPORTER_OTLP_ENDPOINT` is set
- [x] Daemon starts normally (fmt-only tracing) when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset
- [x] OTel service name is `oored`
- [x] `make cargo-check` passes with no errors
- [x] No existing functionality is modified
- [x] Feature documentation passes docs gate

## Owner

Platform team

## Last Updated

`2026-02-06`
