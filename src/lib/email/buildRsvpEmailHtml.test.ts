import { expect, test, describe } from 'vitest';
import { buildRsvpEmailHtml } from './buildRsvpEmailHtml';
import type { RsvpNotificationPayload } from './notification';

function makePayload(
  overrides: Partial<RsvpNotificationPayload> = {},
): RsvpNotificationPayload {
  return {
    isUpdate: false,
    guestName: 'Chris Smith',
    eventName: 'Wedding Reception',
    attendanceStatus: 'attending',
    numberOfAttending: 2,
    specialRequests: null,
    attendees: [
      {
        name: 'Chris Smith',
        mealOption: 'option_a',
        dietaryRestrictions: null,
      },
      {
        name: 'Katie Jones',
        mealOption: 'option_b',
        dietaryRestrictions: 'Vegetarian',
      },
    ],
    ...overrides,
  };
}

describe('buildRsvpEmailHtml', () => {
  test('should render [New RSVP] heading when isUpdate is false', () => {
    const html = buildRsvpEmailHtml(makePayload({ isUpdate: false }));

    expect(html).toContain('[New RSVP]');
    expect(html).not.toContain('[Updated RSVP]');
  });

  test('should render [Updated RSVP] heading when isUpdate is true', () => {
    const html = buildRsvpEmailHtml(makePayload({ isUpdate: true }));

    expect(html).toContain('[Updated RSVP]');
    expect(html).not.toContain('[New RSVP]');
  });

  test('should render guest name and event name', () => {
    const html = buildRsvpEmailHtml(makePayload());

    expect(html).toContain('Chris Smith');
    expect(html).toContain('Wedding Reception');
  });

  test('should render "None" for null specialRequests', () => {
    const html = buildRsvpEmailHtml(makePayload({ specialRequests: null }));

    expect(html).toContain('>None<');
  });

  test('should render special requests text when present', () => {
    const html = buildRsvpEmailHtml(
      makePayload({ specialRequests: 'Gluten free options please' }),
    );

    expect(html).toContain('Gluten free options please');
  });

  test('should render attendee names and meal options', () => {
    const html = buildRsvpEmailHtml(makePayload());

    expect(html).toContain('Chris Smith');
    expect(html).toContain('option_a');
    expect(html).toContain('Katie Jones');
    expect(html).toContain('option_b');
    expect(html).toContain('Vegetarian');
  });

  test('should render "None" for null meal option and dietary restrictions', () => {
    const html = buildRsvpEmailHtml(
      makePayload({
        attendees: [
          { name: 'Alex', mealOption: null, dietaryRestrictions: null },
        ],
      }),
    );

    expect(html).toContain('Meal: None');
    expect(html).toContain('Dietary restrictions: None');
  });

  test('should escape HTML in user-provided fields', () => {
    const html = buildRsvpEmailHtml(
      makePayload({
        guestName: '<script>alert("xss")</script>',
        eventName: '"><img src=x onerror=alert(1)>',
        specialRequests: "<b>bold</b> & 'quoted'",
      }),
    );

    // Tags are escaped — no executable HTML injected
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img ');
    expect(html).toContain('&lt;script&gt;');
    // The img payload is escaped: &lt;img src=x onerror=alert(1)&gt;
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&#x27;');
  });

  test('should render "Not attending" label for not_attending status', () => {
    const html = buildRsvpEmailHtml(
      makePayload({ attendanceStatus: 'not_attending', attendees: [] }),
    );

    expect(html).toContain('Not attending');
  });

  test('should omit attendees section when attendees list is empty', () => {
    const html = buildRsvpEmailHtml(makePayload({ attendees: [] }));

    expect(html).not.toContain('Attendees');
  });

  test('should return a complete HTML document', () => {
    const html = buildRsvpEmailHtml(makePayload());

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });
});
