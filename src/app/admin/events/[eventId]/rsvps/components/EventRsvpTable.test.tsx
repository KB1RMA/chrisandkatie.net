import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventRsvpTable, type EventRsvpRow } from './EventRsvpTable';

vi.mock('../actions', () => ({
  setPartyEventRsvp: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/**
 * Builds a single RSVP row fixture, with sensible defaults.
 *
 * @param overrides - Fields to override.
 */
function makeRow(overrides: Partial<EventRsvpRow> = {}): EventRsvpRow {
  return {
    id: 'guest-1',
    guestName: 'Jane Doe',
    partyName: 'Doe Family',
    invitationId: 'inv-1',
    contactEmail: null,
    rsvpStatus: 'attending',
    hasPartyResponse: true,
    partyRsvpUpdatedAt: '2026-07-01T00:00:00.000Z',
    defaultAttending: true,
    numberOfAttending: 1,
    specialRequests: null,
    notes: null,
    searchText: 'jane doe doe family',
    ...overrides,
  };
}

// jsdom does not implement the native dialog methods the edit modal calls.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function close(
    this: HTMLDialogElement,
  ) {
    this.open = false;
  });
});

describe('EventRsvpTable', () => {
  test('should show a working Edit button for a non-main event', async () => {
    const user = userEvent.setup();

    render(
      <EventRsvpTable
        data={[makeRow()]}
        eventId="event-1"
        isMainEvent={false}
      />,
    );

    const editButton = screen.getByRole('button', { name: 'Edit' });

    await user.click(editButton);

    expect(screen.getByText('Edit RSVP')).toBeInTheDocument();
  });

  // The main event's guest-facing wizard writes only the legacy
  // Guest.attending column and never reads RsvpResponse, so an override saved
  // through this dialog would be invisible to guests. The server action
  // rejects it too; this proves the dead end never reaches the UI.
  test('should not offer an Edit control for the main event', () => {
    render(
      <EventRsvpTable
        data={[makeRow()]}
        eventId="event-1"
        isMainEvent={true}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Edit')).toHaveAttribute(
      'title',
      'Main event attendance is managed through the RSVP wizard and cannot be edited here.',
    );
  });

  test("should hand the edit dialog every member sharing the clicked row's invitationId, and no one else's", async () => {
    const user = userEvent.setup();

    render(
      <EventRsvpTable
        data={[
          makeRow({
            id: 'guest-1',
            guestName: 'Jane Doe',
            invitationId: 'inv-1',
            searchText: 'jane doe doe family',
          }),
          makeRow({
            id: 'guest-2',
            guestName: 'John Doe',
            invitationId: 'inv-1',
            defaultAttending: false,
            searchText: 'john doe doe family',
          }),
          makeRow({
            id: 'guest-3',
            guestName: 'Amy Smith',
            partyName: 'Smith Family',
            invitationId: 'inv-2',
            searchText: 'amy smith smith family',
          }),
        ]}
        eventId="event-1"
        isMainEvent={false}
      />,
    );

    // Open the dialog from Jane's row specifically, not John's or Amy's.
    const janeRow = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Jane Doe') !== null);

    if (!janeRow) {
      throw new Error('Expected to find a table row for Jane Doe');
    }

    await user.click(within(janeRow).getByRole('button', { name: 'Edit' }));

    const dialog = screen.getByRole('dialog');

    // Both members of the inv-1 party appear, each with their own status.
    expect(within(dialog).getByText('Jane Doe')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('radio', { name: 'Jane Doe attending' }),
    ).toBeChecked();
    expect(within(dialog).getByText('John Doe')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('radio', { name: 'John Doe not attending' }),
    ).toBeChecked();

    // The inv-2 party is a different party and must not be offered here.
    expect(within(dialog).queryByText('Amy Smith')).not.toBeInTheDocument();
  });
});
