'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  FIELD_LIMITS,
  HONEYPOT_FIELD,
  INTEREST_AREAS,
  type ContactFieldErrors,
} from '@/lib/contact';

const CONTACT_EMAIL = 'hello@decodasecurity.com';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const BUTTON_LABEL: Record<Status, string> = {
  idle: 'Request follow-up',
  submitting: 'Sending...',
  success: 'Request sent',
  error: 'Try again',
};

/**
 * Client-side contact / demo request form. Submits to the server-side
 * /api/contact route; the browser never sees the email provider or recipient.
 * Manages submit states, surfaces server validation errors against the relevant
 * fields, and announces success/error via ARIA live regions.
 */
export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const baseId = useId();
  const fieldId = (name: string) => `${baseId}-${name}`;
  const errorId = (name: string) => `${baseId}-${name}-error`;

  const isSubmitting = status === 'submitting';

  // Clear stale success/error feedback once the visitor starts editing again.
  // Each setter bails out when nothing actually changes, so this is safe to run
  // on every keystroke.
  function handleFormInput() {
    setStatus((current) => (current === 'error' || current === 'success' ? 'idle' : current));
    setFormError((current) => (current ? null : current));
    setFieldErrors((current) => (Object.keys(current).length ? {} : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return; // guard against duplicate submissions
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      company: String(formData.get('company') ?? ''),
      interestArea: String(formData.get('interestArea') ?? ''),
      message: String(formData.get('message') ?? ''),
      [HONEYPOT_FIELD]: String(formData.get(HONEYPOT_FIELD) ?? ''),
    };

    setStatus('submitting');
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setStatus('success');
        form.reset();
        return;
      }

      const data: unknown = await response.json().catch(() => null);
      const parsed = (data && typeof data === 'object' ? data : {}) as {
        error?: string;
        fieldErrors?: ContactFieldErrors;
      };

      if (response.status === 400 && parsed.error === 'validation' && parsed.fieldErrors) {
        setFieldErrors(parsed.fieldErrors);
        setFormError('Please correct the highlighted fields and try again.');
      } else if (response.status === 429) {
        setFormError('You have sent several requests in a row. Please wait a moment and try again.');
      } else {
        // Generic failure — the inline fallback (with a mailto link) is shown.
        setFormError(null);
      }
      setStatus('error');
    } catch {
      // Network/unexpected error — show the generic fallback.
      setFormError(null);
      setStatus('error');
    }
  }

  const describedBy = (field: keyof ContactFieldErrors) =>
    fieldErrors[field] ? errorId(field) : undefined;
  const invalid = (field: keyof ContactFieldErrors) =>
    fieldErrors[field] ? true : undefined;

  return (
    <form className="contact-form" onSubmit={handleSubmit} onInput={handleFormInput} noValidate>
      <label htmlFor={fieldId('name')}>
        <span>Name</span>
        <input
          id={fieldId('name')}
          name="name"
          type="text"
          required
          maxLength={FIELD_LIMITS.name}
          autoComplete="name"
          placeholder="Jane Smith"
          aria-required="true"
          aria-invalid={invalid('name')}
          aria-describedby={describedBy('name')}
        />
        {fieldErrors.name ? (
          <span className="field-error" id={errorId('name')}>
            {fieldErrors.name}
          </span>
        ) : null}
      </label>

      <label htmlFor={fieldId('email')}>
        <span>Work email</span>
        <input
          id={fieldId('email')}
          name="email"
          type="email"
          required
          maxLength={FIELD_LIMITS.email}
          autoComplete="email"
          placeholder="jane@institution.com"
          aria-required="true"
          aria-invalid={invalid('email')}
          aria-describedby={describedBy('email')}
        />
        {fieldErrors.email ? (
          <span className="field-error" id={errorId('email')}>
            {fieldErrors.email}
          </span>
        ) : null}
      </label>

      <label htmlFor={fieldId('company')}>
        <span>Company</span>
        <input
          id={fieldId('company')}
          name="company"
          type="text"
          maxLength={FIELD_LIMITS.company}
          autoComplete="organization"
          placeholder="Institution name"
          aria-invalid={invalid('company')}
          aria-describedby={describedBy('company')}
        />
        {fieldErrors.company ? (
          <span className="field-error" id={errorId('company')}>
            {fieldErrors.company}
          </span>
        ) : null}
      </label>

      <label htmlFor={fieldId('interestArea')}>
        <span>Interest area</span>
        <select
          id={fieldId('interestArea')}
          name="interestArea"
          required
          defaultValue=""
          aria-required="true"
          aria-invalid={invalid('interestArea')}
          aria-describedby={describedBy('interestArea')}
        >
          <option value="" disabled>
            Select one
          </option>
          {INTEREST_AREAS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
        {fieldErrors.interestArea ? (
          <span className="field-error" id={errorId('interestArea')}>
            {fieldErrors.interestArea}
          </span>
        ) : null}
      </label>

      <label htmlFor={fieldId('message')}>
        <span>What are you evaluating?</span>
        <textarea
          id={fieldId('message')}
          name="message"
          required
          rows={6}
          maxLength={FIELD_LIMITS.message}
          placeholder="Share the use case, timelines, or security questions Decoda should prepare for."
          aria-required="true"
          aria-invalid={invalid('message')}
          aria-describedby={describedBy('message')}
        />
        {fieldErrors.message ? (
          <span className="field-error" id={errorId('message')}>
            {fieldErrors.message}
          </span>
        ) : null}
      </label>

      {/* Honeypot: hidden from people and assistive tech; bots that fill it are
          silently dropped server-side. */}
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor={fieldId(HONEYPOT_FIELD)}>Company website</label>
        <input
          id={fieldId(HONEYPOT_FIELD)}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <button type="submit" className="button-primary" disabled={isSubmitting}>
        {BUTTON_LABEL[status]}
      </button>

      {/* Polite live region for the success confirmation. */}
      <div aria-live="polite" role="status">
        {status === 'success' ? (
          <p className="form-status form-status--success">
            Thanks — your request has been sent to the Decoda team. We&apos;ll follow up using the
            work email you provided.
          </p>
        ) : null}
      </div>

      {/* Assertive live region for errors. */}
      <div aria-live="assertive" role="alert">
        {status === 'error' ? (
          <p className="form-status form-status--error">
            {formError ?? (
              <>
                We couldn&apos;t send your request. Please try again or email{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> directly.
              </>
            )}
          </p>
        ) : null}
      </div>

      {status !== 'success' ? (
        <p className="form-note">Your details are sent directly to the Decoda team.</p>
      ) : null}
    </form>
  );
}
