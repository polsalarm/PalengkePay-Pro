import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import type { Plugin } from 'vite'

const devPort = Number(process.env.PORT)

// Load .env.local / .env.development into process.env so SSR-loaded /api/*
// handlers (RAMP_ADMIN_KEY, PDAX_*, ANCHOR_*, VAPID_*, etc.) see server-side
// env vars. Vite only exposes VITE_* to client by default — non-prefixed
// vars never reach process.env without this preload.
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
const serverEnv = loadEnv(mode, process.cwd(), '')
for (const [key, value] of Object.entries(serverEnv)) {
  if (process.env[key] === undefined && typeof value === 'string' && value !== '') {
    process.env[key] = value
  }
}

// ── Dev-only middleware that emulates Vercel rewrites + serverless handlers ──
// In production the /api/* routes are served by Vercel from `frontend/api/*.ts`.
// `vite` (npm run dev) does not know about those, so /api/* requests fall
// through to the SPA fallback and the client receives index.html — which
// breaks ramp/cashin/cashout calls locally. This plugin loads the handlers
// via SSR and dispatches requests using the same _op rewrite scheme that
// vercel.json configures for production.
interface ApiRewrite { match: RegExp; module: string; op?: string }
const API_REWRITES: ApiRewrite[] = [
  { match: /^\/\.well-known\/stellar\.toml$/, module: 'stellar-toml' },
  { match: /^\/api\/sep24\/info$/, module: 'sep24', op: 'info' },
  { match: /^\/api\/sep24\/transactions\/deposit\/interactive$/, module: 'sep24', op: 'deposit-interactive' },
  { match: /^\/api\/sep24\/transactions\/withdraw\/interactive$/, module: 'sep24', op: 'withdraw-interactive' },
  { match: /^\/api\/sep24\/transaction$/, module: 'sep24', op: 'transaction' },
  { match: /^\/api\/sep24\/transactions$/, module: 'sep24', op: 'transactions' },
  { match: /^\/api\/ramp\/cashout$/, module: 'ramp', op: 'cashout' },
  { match: /^\/api\/ramp\/cashin$/, module: 'ramp', op: 'cashin' },
  { match: /^\/api\/ramp\/status$/, module: 'ramp', op: 'status' },
  { match: /^\/api\/ramp\/admin$/, module: 'ramp', op: 'admin' },
]

function vercelApiDevPlugin(): Plugin {
  const apiRoot = path.resolve(process.cwd(), 'api')
  return {
    name: 'vercel-api-dev',
    enforce: 'pre',
    resolveId(source, importer) {
      // Vercel /api/*.ts source files use NodeNext-style ".js" import
      // specifiers that resolve to ".ts" siblings. Vite's default resolver
      // does not perform this rewrite in SSR; map it explicitly.
      if (!importer) return null
      if (!importer.includes(`${path.sep}api${path.sep}`) && !importer.includes('/api/')) return null
      if (!source.startsWith('.') || !source.endsWith('.js')) return null
      const candidate = path.resolve(path.dirname(importer), source.replace(/\.js$/, '.ts'))
      if (fs.existsSync(candidate)) return candidate
      return null
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? ''
        if (!rawUrl.startsWith('/api/') && !rawUrl.startsWith('/.well-known/')) return next()

        const url = new URL(rawUrl, 'http://localhost')
        let moduleName: string | null = null
        let opOverride: string | undefined
        for (const rule of API_REWRITES) {
          if (rule.match.test(url.pathname)) {
            moduleName = rule.module
            opOverride = rule.op
            break
          }
        }
        if (!moduleName) {
          const m = url.pathname.match(/^\/api\/([\w-]+(?:\/[\w-]+)*)$/)
          if (!m) return next()
          moduleName = m[1]
        }

        const candidatePath = path.join(apiRoot, `${moduleName}.ts`)
        if (!fs.existsSync(candidatePath)) return next()

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const raw = Buffer.concat(chunks).toString('utf8')
          let parsedBody: unknown = undefined
          if (raw) {
            const ct = String(req.headers['content-type'] ?? '')
            if (ct.includes('application/json')) {
              try { parsedBody = JSON.parse(raw) } catch { parsedBody = raw }
            } else if (ct.includes('application/x-www-form-urlencoded')) {
              parsedBody = Object.fromEntries(new URLSearchParams(raw))
            } else {
              parsedBody = raw
            }
          }

          const query: Record<string, string> = {}
          for (const [k, v] of url.searchParams.entries()) query[k] = v
          if (opOverride) query._op = opOverride

          const shimReq = req as unknown as Record<string, unknown>
          shimReq.query = query
          shimReq.body = parsedBody
          shimReq.cookies = {}

          let statusCode = 200
          const shimRes = res as unknown as Record<string, unknown>
          shimRes.status = (code: number) => { statusCode = code; res.statusCode = code; return shimRes }
          shimRes.json = (obj: unknown) => {
            if (!res.headersSent) res.setHeader('Content-Type', 'application/json')
            res.statusCode = statusCode
            res.end(JSON.stringify(obj))
            return shimRes
          }
          shimRes.send = (payload: unknown) => {
            res.statusCode = statusCode
            if (typeof payload === 'string' || Buffer.isBuffer(payload)) res.end(payload)
            else res.end(JSON.stringify(payload))
            return shimRes
          }

          const mod = await server.ssrLoadModule(`/api/${moduleName}.ts`)
          const handler = (mod as { default?: unknown }).default
          if (typeof handler !== 'function') {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `api handler not exported: ${moduleName}` }))
            return
          }
          await (handler as (req: unknown, res: unknown) => unknown)(shimReq, shimRes)
        } catch (err) {
          console.error('[vercel-api-dev]', moduleName, (err as Error)?.stack ?? err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: (err as Error)?.message ?? 'api dev plugin failure' }))
          }
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    vercelApiDevPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'PalengkePay',
        short_name: 'PalengkePay',
        description: 'Stellar micropayments for Philippine wet markets',
        theme_color: '#008055',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    exclude: [...configDefaults.exclude, 'tests/**'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: Number.isFinite(devPort) && devPort > 0
    ? { host: '127.0.0.1', port: devPort }
    : undefined,
})
