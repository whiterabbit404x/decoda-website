import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/platform/platform.module.css';

export const metadata: Metadata = { title: 'Decoda | Sign-in', robots: { index: false, follow: false } };

const MESSAGES: Record<string, { title: string; body: string }> = {
  unavailable: {
    title: 'Sign-in is temporarily unavailable',
    body: 'Decoda sign-in is not available right now. Nothing is wrong with your account — please try again shortly.',
  },
  expired: {
    title: 'Your sign-in session expired',
    body: 'The sign-in took too long or was started in another tab. Start again and it will complete normally.',
  },
  failed: {
    title: "We couldn't sign you in",
    body: 'Something went wrong while completing sign-in. Start again, and if it keeps happening contact Decoda with the reference below.',
  },
};

const REF_RE = /^req_[0-9a-f]{24}$/;

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string; ref?: string }> }) {
  const { reason, ref } = await searchParams;
  const message = MESSAGES[reason ?? ''] ?? MESSAGES.failed!;
  const reference = ref && REF_RE.test(ref) ? ref : null;
  return (
    <div className="content-stack">
      <div className={styles.page}>
        <section className={styles.panel} role="alert" aria-labelledby="auth-error">
          <p className="eyebrow">Sign in to Decoda</p>
          <h2 id="auth-error">{message.title}</h2>
          <p>{message.body}</p>
          {reference ? <p className={styles.muted}>Reference: {reference}</p> : null}
          <p style={{ marginTop: 16 }} className={styles.inlineActions}>
            {reason !== 'unavailable' ? (
              <a className="button-primary" href="/sign-in">
                Sign in again
              </a>
            ) : null}
            <Link className={styles.linkButton} href="/">
              Back to decodasecurity.com
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
