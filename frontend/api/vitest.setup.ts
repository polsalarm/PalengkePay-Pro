// Test setup for server-side /api handlers.
//
// vite.config.ts preloads .env.local into process.env so the dev server's SSR
// /api/* handlers see server-only vars. Under vitest that also leaks real
// KV/Upstash credentials into the test process, flipping the ramp/push/status
// stores and the sponsor rate-limit readiness check onto a live Redis instance —
// which makes list operations hit the network and time out non-deterministically.
//
// Force the in-memory fallback by clearing the KV/Redis env before any store
// module is imported. Tests that exercise the durable path set these vars
// explicitly themselves (see health.test.ts).
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
