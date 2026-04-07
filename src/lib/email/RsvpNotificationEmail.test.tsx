/**
 * @vitest-environment node
 */

import { expect, test, describe } from 'vitest';
import { render as toHtml } from '@react-email/render';
import { RsvpNotificationEmail } from './RsvpNotificationEmail';
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

describe('RsvpNotificationEmail', () => {
  test('should match snapshot for isUpdate: false (new RSVP)', async () => {
    const payload = makePayload({ isUpdate: false });
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).toMatchSnapshot();
  });

  test('should render [New RSVP] heading when isUpdate is false', async () => {
    const payload = makePayload({ isUpdate: false });
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).toContain('[New RSVP]');
    expect(html).not.toContain('[Updated RSVP]');
  });

  test('should render guest name and event name', async () => {
    const payload = makePayload();
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).toContain('Chris Smith');
    expect(html).toContain('Wedding Reception');
  });

  test('should render "None" for null specialRequests', async () => {
    const payload = makePayload({ specialRequests: null });
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).toContain('None');
  });

  test('should render special requests text when present', async () => {
    const payload = makePayload({
      specialRequests: 'Gluten free options please',
    });
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).toContain('Gluten free options please');
  });

  test('should render attendee names and meal options', async () => {
    const payload = makePayload();
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).toContain('Chris Smith');
    expect(html).toContain('option_a');
    expect(html).toContain('Katie Jones');
    expect(html).toContain('option_b');
    expect(html).toContain('Vegetarian');
  });
});

describe('RsvpNotificationEmail — isUpdate: true', () => {
  test('should match snapshot for isUpdate: true (updated RSVP)', async () => {
    const payload = makePayload({ isUpdate: true });
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).toMatchSnapshot();
  });

  test('should render [Updated RSVP] heading when isUpdate is true', async () => {
    const payload = makePayload({ isUpdate: true });
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).toContain('[Updated RSVP]');
    expect(html).not.toContain('[New RSVP]');
  });

  test('should not render [New RSVP] when isUpdate is true', async () => {
    const payload = makePayload({ isUpdate: true });
    const html = await toHtml(RsvpNotificationEmail(payload));

    expect(html).not.toContain('[New RSVP]');
  });
});
