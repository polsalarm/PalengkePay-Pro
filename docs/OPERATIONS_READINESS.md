# Operations Readiness

## Sponsor Ops

- Fee-bump endpoint uses request validation plus rate-limit controls.
- Durable Redis/KV config is required for production-like durability mode.

## Observability

- `/api/health` provides runtime endpoint status.
- `/admin/health` and `/admin/proofs` expose operational proof surfaces.

## Runbooks

- Confirm sponsor env presence in deployment scope before release.
- Track response modes and alert on degraded health.
