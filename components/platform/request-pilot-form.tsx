'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import {
  interpretPilotResponse,
  PILOT_FIELD_LIMITS,
  PILOT_FORM_HEADER,
  PILOT_FORM_HEADER_VALUE,
  PILOT_HONEYPOT_FIELD,
  PILOT_PRODUCT_OPTIONS,
  TEAM_SIZES,
  type PilotFieldErrors,
} from '@/lib/platform/pilot-form';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const CONTACT_EMAIL = 'hello@decodasecurity.com';

/**
 * Public Request Pilot form. Submits to POST /api/pilot-requests; the server
 * validates everything again, and a submission creates a review request —
 * never an account.
 */
export function RequestPilotForm({ formToken, preselected }: { formToken: string; preselected: string[] }) {
  const [status, setStatus] = useState<Status>('idle');
  const [fieldErrors, setFieldErrors] = useState<PilotFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const inFlight = useRef(false);
  const baseId = useId();
  const fieldId = (name: string) => `${baseId}-${name}`;
  const errorId = (name: string) => `${baseId}-${name}-error`;

  function handleInput() {
    setStatus((current) => (current === 'error' ? 'idle' : current));
    setFormError((current) => (current ? null : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      email: String(data.get('email') ?? ''),
      fullName: String(data.get('fullName') ?? ''),
      company: String(data.get('company') ?? ''),
      role: String(data.get('role') ?? ''),
      companyWebsite: String(data.get('companyWebsite') ?? ''),
      requestedProducts: data.getAll('requestedProducts').map(String),
      useCase: String(data.get('useCase') ?? ''),
      teamSize: String(data.get('teamSize') ?? ''),
      notes: String(data.get('notes') ?? ''),
      formToken,
      [PILOT_HONEYPOT_FIELD]: String(data.get(PILOT_HONEYPOT_FIELD) ?? ''),
    };
    setStatus('submitting');
    setFieldErrors({});
    setFormError(null);
    try {
      const response = await fetch('/api/pilot-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json', [PILOT_FORM_HEADER]: PILOT_FORM_HEADER_VALUE },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });
      const outcome = interpretPilotResponse(response.status, await response.json().catch(() => null));
      if (outcome.kind === 'success') {
        setReference(outcome.reference);
        setStatus('success');
        form.reset();
        return;
      }
      if (outcome.kind === 'validation') {
        setFieldErrors(outcome.fieldErrors);
        setFormError('Please correct the highlighted fields and try again.');
      } else if (outcome.kind === 'expired') {
        setFormError('This form expired. Refresh the page and submit it again.');
      } else if (outcome.kind === 'rate_limited') {
        setFormError('You have sent several requests in a row. Please wait a while and try again.');
      } else {
        setFormError(null);
        setReference(outcome.reference);
      }
      setStatus('error');
    } catch {
      setFormError(null);
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }

  const described = (field: keyof PilotFieldErrors, hint?: string) =>
    [fieldErrors[field] ? errorId(field) : null, hint ?? null].filter(Boolean).join(' ') || undefined;
  const invalid = (field: keyof PilotFieldErrors) => (fieldErrors[field] ? true : undefined);
  const error = (field: keyof PilotFieldErrors) =>
    fieldErrors[field] ? (
      <span className="field-error" id={errorId(field)}>
        {fieldErrors[field]}
      </span>
    ) : null;

  if (status === 'success') {
    return (
      <div className="contact-form" aria-live="polite" role="status" style={{ alignContent: 'start' }}>
        <p className="eyebrow">Request received</p>
        <h2 style={{ margin: 0 }}>Thanks for requesting access to Decoda.</h2>
        <p className="form-note">
          We&apos;ve received your request and will review the requested product access. We&apos;ll follow up at the work
          email you provided. Submitting this form does not create an account — if your request is approved, you&apos;ll
          receive a separate invitation.
        </p>
        {reference ? <p className="form-note">Reference: {reference}</p> : null}
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} onInput={handleInput} noValidate aria-describedby={`${baseId}-secret-note`}>
      <label htmlFor={fieldId('email')}>
        <span>Work email</span>
        <input id={fieldId('email')} name="email" type="email" required maxLength={PILOT_FIELD_LIMITS.email} autoComplete="email"
          placeholder="jane@institution.com" aria-required="true" aria-invalid={invalid('email')} aria-describedby={described('email')} />
        {error('email')}
      </label>

      <label htmlFor={fieldId('fullName')}>
        <span>Full name</span>
        <input id={fieldId('fullName')} name="fullName" type="text" required maxLength={PILOT_FIELD_LIMITS.fullName} autoComplete="name"
          placeholder="Jane Smith" aria-required="true" aria-invalid={invalid('fullName')} aria-describedby={described('fullName')} />
        {error('fullName')}
      </label>

      <label htmlFor={fieldId('company')}>
        <span>Company</span>
        <input id={fieldId('company')} name="company" type="text" required maxLength={PILOT_FIELD_LIMITS.company} autoComplete="organization"
          placeholder="Institution name" aria-required="true" aria-invalid={invalid('company')} aria-describedby={described('company')} />
        {error('company')}
      </label>

      <label htmlFor={fieldId('role')}>
        <span>Job title / role</span>
        <input id={fieldId('role')} name="role" type="text" required maxLength={PILOT_FIELD_LIMITS.role} autoComplete="organization-title"
          placeholder="Head of Digital Assets" aria-required="true" aria-invalid={invalid('role')} aria-describedby={described('role')} />
        {error('role')}
      </label>

      <label htmlFor={fieldId('companyWebsite')}>
        <span>Company website (optional)</span>
        <input id={fieldId('companyWebsite')} name="companyWebsite" type="text" inputMode="url" maxLength={PILOT_FIELD_LIMITS.companyWebsite}
          autoComplete="url" placeholder="institution.com" aria-invalid={invalid('companyWebsite')} aria-describedby={described('companyWebsite')} />
        {error('companyWebsite')}
      </label>

      <fieldset className="pilot-products" aria-invalid={invalid('requestedProducts')} aria-describedby={described('requestedProducts')}>
        <legend>Product interest</legend>
        {PILOT_PRODUCT_OPTIONS.map((option) => (
          <label key={option.value} className="pilot-product-option" htmlFor={fieldId(`product-${option.value}`)}>
            <input id={fieldId(`product-${option.value}`)} type="checkbox" name="requestedProducts" value={option.value}
              defaultChecked={preselected.includes(option.value)} />
            <span>
              <strong>{option.label}</strong>
              <span className="pilot-product-note">{option.note}</span>
            </span>
          </label>
        ))}
        {error('requestedProducts')}
      </fieldset>

      <label htmlFor={fieldId('useCase')}>
        <span>Primary use case (optional)</span>
        <textarea id={fieldId('useCase')} name="useCase" rows={3} maxLength={PILOT_FIELD_LIMITS.useCase}
          placeholder="e.g. monitoring a tokenized treasury fund, testnet treasury operations"
          aria-invalid={invalid('useCase')} aria-describedby={described('useCase')} />
        {error('useCase')}
      </label>

      <label htmlFor={fieldId('teamSize')}>
        <span>Number of team members (optional)</span>
        <select id={fieldId('teamSize')} name="teamSize" defaultValue="" aria-invalid={invalid('teamSize')} aria-describedby={described('teamSize')}>
          <option value="">Prefer not to say</option>
          {TEAM_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        {error('teamSize')}
      </label>

      <label htmlFor={fieldId('notes')}>
        <span>Notes (optional)</span>
        <textarea id={fieldId('notes')} name="notes" rows={4} maxLength={PILOT_FIELD_LIMITS.notes}
          placeholder="Timelines, integrations, or security questions for the Decoda team."
          aria-invalid={invalid('notes')} aria-describedby={described('notes')} />
        {error('notes')}
      </label>

      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor={fieldId(PILOT_HONEYPOT_FIELD)}>Fax number</label>
        <input id={fieldId(PILOT_HONEYPOT_FIELD)} name={PILOT_HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="form-note" id={`${baseId}-secret-note`}>
        Do not include private keys, credentials, seed phrases or other secrets.
      </p>

      <button type="submit" className="button-primary" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Submitting…' : 'Request pilot access'}
      </button>

      <div aria-live="assertive" role="alert">
        {status === 'error' ? (
          <p className="form-status form-status--error">
            {formError ?? (
              <>
                We couldn&apos;t record your request. Please try again or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                {reference ? ` (reference ${reference})` : ''}.
              </>
            )}
          </p>
        ) : null}
      </div>
    </form>
  );
}
