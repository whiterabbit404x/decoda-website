/**
 * POST /api/pilot-requests — public Request Pilot submission.
 * All logic (and its tests) lives in lib/platform/pilot-api.ts.
 */
import { pilotEmailConfig, productUrls, requirePlatformSecret } from '@/lib/platform/config';
import { getPool } from '@/lib/platform/db';
import { handlePilotRequestSubmission } from '@/lib/platform/pilot-api';
import { sendEmailViaResend } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PER_IP = { limit: 5, windowMs: 10 * 60 * 1000 };

export async function POST(request: Request): Promise<Response> {
  return handlePilotRequestSubmission(request, () => ({
    secret: requirePlatformSecret(),
    pool: getPool(),
    sendEmail: sendEmailViaResend,
    emailConfig: pilotEmailConfig(),
    websiteUrl: productUrls().website,
    rateLimit: (key) => rateLimit(key, PER_IP),
  }));
}
