# PR #1 Phase 2 API Negative Probes

Generated: 2026-05-20T11:07:34.957Z

| Probe | Expected | Actual | Result |
|---|---:|---:|---|
| push-subscribe GET rejects non-POST | 405 | 405 | PASS |
| push-subscribe missing VAPID rejects registration | 503 | 503 | PASS |
| push-subscribe invalid wallet rejected | 400 | 400 | PASS |
| push-subscribe invalid subscription rejected | 400 | 400 | PASS |
| push-notify GET rejects non-POST | 405 | 405 | PASS |
| push-notify invalid wallet rejected | 400 | 400 | PASS |
| push-send GET rejects non-POST | 405 | 405 | PASS |
| push-send invalid subscription rejected | 400 | 400 | PASS |
| cron production requires CRON_SECRET | 500 | 500 | PASS |

Summary: 9/9 probes passed.