/**
 * POST /api/webhooks/workos — WorkOS event webhook for the Decoda platform.
 *
 * Unauthenticated by design (WorkOS calls it); authenticity comes solely from
 * the WorkOS-Signature HMAC, verified before the body is parsed. See
 * lib/platform/webhooks.ts for the full order of checks, idempotency and
 * replay handling.
 */
import { PlatformConfigError } from '@/lib/platform/errors';
import { requestIdFor } from '@/lib/platform/request-context';
import { handleWorkOSWebhook } from '@/lib/platform/webhooks';
import { getWorkOSGateway } from '@/lib/platform/workos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 256 * 1024;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFor(request);
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return json({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE', request_id: requestId } }, 413);
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return json({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE', request_id: requestId } }, 413);
  }

  let gateway;
  try {
    gateway = getWorkOSGateway();
  } catch (error) {
    if (error instanceof PlatformConfigError) {
      console.error('[platform:webhook] not configured', { request_id: requestId, diagnostic: error.diagnostic });
      return json({ ok: false, error: { code: error.code, request_id: requestId } }, 503);
    }
    throw error;
  }

  const result = await handleWorkOSWebhook(rawBody, request.headers.get('workos-signature'), requestId, { gateway });
  return json(result.body, result.status);
}
