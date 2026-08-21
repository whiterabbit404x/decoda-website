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

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend API key used to send email. |
| `CONTACT_TO_EMAIL` | Destination inbox (defaults to `hello@decodasecurity.com`). |
| `CONTACT_FROM_EMAIL` | Verified sender (defaults to `Decoda Website <noreply@decodasecurity.com>`). |
| `CONTACT_SEND_CONFIRMATION` | Set to `false` to skip the visitor acknowledgment email. |

The recipient is always resolved server-side from configuration and can never be
set by the browser.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit tests for the contact form logic
npm run build       # production build
```
