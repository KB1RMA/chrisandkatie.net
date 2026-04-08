import type { RsvpNotificationPayload } from './notification';

/**
 * Escapes a string for safe inclusion in HTML content.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Build the HTML string for an RSVP notification email.
 *
 * Uses inline styles matching the site's typography for email-client
 * compatibility. All user-provided values are HTML-escaped.
 *
 * @param payload - The RSVP notification data to render.
 * @returns A complete HTML document string ready for Resend's `html:` option.
 */
export function buildRsvpEmailHtml(payload: RsvpNotificationPayload): string {
  const {
    isUpdate,
    guestName,
    eventName,
    attendanceStatus,
    numberOfAttending,
    specialRequests,
    attendees,
  } = payload;

  const headingLabel = isUpdate ? '[Updated RSVP]' : '[New RSVP]';
  const attendanceLabel =
    attendanceStatus === 'attending' ? 'Attending' : 'Not attending';

  const attendeesHtml = attendees
    .map(
      (a) =>
        `<div style="background-color:#f9f9f9;border-radius:4px;padding:12px;margin-bottom:8px;">` +
        `<p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0 0 4px 0;">${esc(a.name)}</p>` +
        `<p style="font-size:13px;color:#555555;margin:0 0 2px 0;">Meal: ${esc(a.mealOption ?? 'None')}</p>` +
        `<p style="font-size:13px;color:#555555;margin:0 0 2px 0;">Dietary restrictions: ${esc(a.dietaryRestrictions ?? 'None')}</p>` +
        `</div>`,
    )
    .join('');

  const attendeesSection =
    attendees.length > 0
      ? `<p style="font-size:12px;font-weight:600;text-transform:uppercase;color:#888888;margin-bottom:2px;">Attendees</p>${attendeesHtml}`
      : '';

  return (
    `<!DOCTYPE html>` +
    `<html lang="en">` +
    `<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="background-color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;">` +
    `<div style="max-width:560px;margin:0 auto;padding:32px 24px;">` +
    `<h1 style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">${esc(headingLabel)} ${esc(guestName)}</h1>` +
    `<p style="font-size:14px;color:#555555;margin-top:0;">Event: ${esc(eventName)}</p>` +
    `<hr style="border-color:#e0e0e0;margin:20px 0;">` +
    `<p style="font-size:12px;font-weight:600;text-transform:uppercase;color:#888888;margin-bottom:2px;">Attendance</p>` +
    `<p style="font-size:15px;color:#1a1a1a;margin-top:0;margin-bottom:16px;">${esc(attendanceLabel)}</p>` +
    `<p style="font-size:12px;font-weight:600;text-transform:uppercase;color:#888888;margin-bottom:2px;">Number attending</p>` +
    `<p style="font-size:15px;color:#1a1a1a;margin-top:0;margin-bottom:16px;">${numberOfAttending}</p>` +
    `<p style="font-size:12px;font-weight:600;text-transform:uppercase;color:#888888;margin-bottom:2px;">Special requests</p>` +
    `<p style="font-size:15px;color:#1a1a1a;margin-top:0;margin-bottom:16px;">${esc(specialRequests ?? 'None')}</p>` +
    attendeesSection +
    `<hr style="border-color:#e0e0e0;margin:20px 0;">` +
    `<p style="font-size:12px;color:#aaaaaa;text-align:center;">chrisandkatie.net</p>` +
    `</div>` +
    `</body>` +
    `</html>`
  );
}
