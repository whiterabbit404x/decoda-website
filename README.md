# Decoda Website

Public-facing Next.js marketing website for Decoda, positioning the company as the parent brand and RWA Security as the current flagship solution.

## Routes

- `/`
- `/solutions/rwa-security`
- `/platform`
- `/contact`

## Run locally

```bash
npm install
npm run dev
```

## Contact / demo form

The `/contact` page renders a demo-request form that submits to the server-side
route handler at `POST /api/contact`. The handler validates the submission,
applies lightweight spam protection (honeypot + in-memory rate limiting), and
delivers a notification email to the Decoda inbox via [Resend](https://resend.com).

Delivery flow:

```
Request a demo (navbar) → /contact → visitor submits form
  → POST /api/contact (server validates) → email to hello@decodasecurity.com
  → inline success confirmation
```

- The notification is sent **to** `hello@decodasecurity.com`.
- The **From** address is a verified Decoda sender (`Decoda Website
  <noreply@decodasecurity.com>`); the visitor's work email is used only as
  `reply-to`, never spoofed as the sender.
- A best-effort acknowledgment email is also sent to the visitor (can be
  disabled). Its failure never affects the primary delivery.

### Environment variables

Copy `.env.example` to `.env.local` and set the values (server-side only —
never committed):

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | **Yes** | Resend API key used to send email. Without it every submission fails with `502 CONTACT_SEND_FAILED`. |
| `CONTACT_TO_EMAIL` | No | Destination inbox (defaults to `hello@decodasecurity.com`). |
| `CONTACT_FROM_EMAIL` | No | Verified sender (defaults to `Decoda Website <noreply@decodasecurity.com>`). The domain must be verified in Resend. |
| `CONTACT_SEND_CONFIRMATION` | No | Set to `false` to skip the visitor acknowledgment email. |

The recipient is always resolved server-side from configuration and can never be
set by the browser.

**Production (Vercel).** Set these under Project → Settings → Environment
Variables with the **Production** scope, then **redeploy** — Vercel injects
environment variables at deploy time, so an existing deployment will keep
failing until a new one is built. The sending domain must also be verified at
<https://resend.com/domains>; an unverified domain makes Resend reject every
send with `403 … domain is not verified`.

### API contract

`POST /api/contact` always answers with JSON and `Cache-Control: no-store`:

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{ "ok": true }` | The provider accepted the message. Only this is treated as success. |
| 400 | `{ "ok": false, "error": "CONTACT_VALIDATION_FAILED", "fieldErrors": { … } }` | Server-side validation rejected the input. |
| 400 | `{ "ok": false, "error": "CONTACT_INVALID_REQUEST" }` | Body was not valid JSON. |
| 429 | `{ "ok": false, "error": "CONTACT_RATE_LIMITED" }` | Per-IP rate limit tripped. |
| 502 | `{ "ok": false, "error": "CONTACT_SEND_FAILED" }` | Configuration or provider failure. |

A 2xx status alone is never treated as delivery — the client requires an
explicit `ok: true`, which the server sets only after the provider returns a
delivery id.

### Diagnosing a failed submission

Provider errors are never shown to visitors, so `502 CONTACT_SEND_FAILED` is
diagnosed from the server logs (Vercel → Deployment → Functions →
`/api/contact`). Each failure logs one structured, secret-free line:

```
[contact] primary notification send failed {
  reason: 'config',            // 'config' = fix an env var or verify the domain
  code: 'validation_error',    // 'provider' = transient; retry may succeed
  statusCode: 401,
  providerMessage: 'API key is invalid'
}
```

| What the log shows | Fix |
| --- | --- |
| `code: 'MISSING_API_KEY'` | `RESEND_API_KEY` is not set for this environment. Add it and redeploy. |
| `statusCode: 401`, `API key is invalid` | The key is wrong or revoked. Issue a new one. |
| `statusCode: 403`, `… domain is not verified` | Verify the `CONTACT_FROM_EMAIL` domain in Resend. |
| `reason: 'provider'` | Transient provider/transport failure; the visitor can retry. |

API keys are redacted from anything this path logs.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit tests for the contact form logic
npm run build       # production build
```

To exercise the real send path without a Resend account, point the SDK at a
local stub with `RESEND_BASE_URL` and any non-empty `RESEND_API_KEY`.
