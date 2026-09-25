/**
 * Email templates for the Decoda platform.
 *
 * Every template returns plain text AND escaped HTML built from the same
 * content, so user input is never rendered as markup. Handlers call these
 * functions; no handler assembles email HTML itself.
 *
 * The prospect confirmation deliberately says "received" and "will review" —
 * it never implies approval or access.
 */
import { escapeHtml } from '../contact';
import type { PilotSubmission } from './pilot-requests';
import { productListText } from './pilot-requests';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const WRAPPER_OPEN = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0b1220;max-width:560px;">';
const WRAPPER_CLOSE = '</div>';
const paragraph = (value: string) => `<p style="margin:0 0 14px;">${escapeHtml(value)}</p>`;

export function pilotConfirmationEmail(data: Pick<PilotSubmission, 'fullName' | 'requestedProducts'>): RenderedEmail {
  const products = productListText(data.requestedProducts);
  const lines = [
    `Hi ${data.fullName},`,
    "Thanks for requesting access to Decoda. We've received your request and will review the requested product access.",
    `Products requested: ${products}.`,
    'A member of the Decoda team will follow up at this address. This email does not grant access: if your request is approved, you will receive a separate invitation to create your Decoda account.',
    'Please do not reply with private keys, credentials, seed phrases or other secrets.',
  ];
  const text = `${lines.join('\n\n')}\n\nDecoda Security\nhttps://www.decodasecurity.com\n`;
  const html = [
    WRAPPER_OPEN,
    ...lines.map(paragraph),
    '<p style="margin:0;">Decoda Security<br /><a href="https://www.decodasecurity.com">www.decodasecurity.com</a></p>',
    WRAPPER_CLOSE,
  ].join('');
  return { subject: "We've received your Decoda access request", text, html };
}

export function pilotInternalNotificationEmail(
  data: PilotSubmission,
  context: { pilotRequestId: string; requestId: string; reviewUrl: string; submittedAt: Date },
): RenderedEmail {
  const rows: Array<[string, string]> = [
    ['Name', data.fullName],
    ['Work email', data.email + (data.freeMailDomain ? '  (consumer mailbox domain)' : '')],
    ['Company', data.company],
    ['Role', data.role],
    ['Website', data.companyWebsite ?? '—'],
    ['Products', productListText(data.requestedProducts)],
    ['Team size', data.teamSize ?? '—'],
    ['Primary use case', data.useCase ?? '—'],
    ['Notes', data.notes ?? '—'],
    ['Submitted at', context.submittedAt.toISOString()],
    ['Reference', context.requestId],
  ];
  const text = [
    'New Decoda pilot request (pending review)',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    `Review: ${context.reviewUrl}`,
    '',
    'Nothing has been provisioned. Approve or reject it in the platform admin console.',
  ].join('\n');
  const row = (label: string, value: string) =>
    '<tr>' +
    `<td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>` +
    `<td style="padding:4px 0;white-space:pre-wrap;">${escapeHtml(value)}</td>` +
    '</tr>';
  const html = [
    WRAPPER_OPEN,
    '<h2 style="margin:0 0 14px;font-size:18px;">New Decoda pilot request (pending review)</h2>',
    '<table style="border-collapse:collapse;margin:0 0 16px;">',
    ...rows.map(([label, value]) => row(label, value)),
    '</table>',
    `<p style="margin:0 0 14px;"><a href="${escapeHtml(context.reviewUrl)}">Review in the platform admin console</a></p>`,
    paragraph('Nothing has been provisioned. Approve or reject it in the platform admin console.'),
    WRAPPER_CLOSE,
  ].join('');
  return { subject: `New Decoda pilot request: ${data.company} (${productListText(data.requestedProducts)})`, text, html };
}
