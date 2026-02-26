'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';
import { updateInvitationVisibleEvents } from '@/app/admin/invitations/actions';

type AvailableEvent = {
  id: string;
  name: string;
  sortOrder: number;
};

type EventVisibilityEditorProps = {
  invitationId: string;
  availableEvents: AvailableEvent[];
  initialVisibleEventIds: string[];
};

/**
 * Event visibility editor for invitations.
 *
 * Displays checkboxes for each available DB event with save functionality.
 * Updates guestEvents rows via server action.
 */
export function EventVisibilityEditor({
  invitationId,
  availableEvents,
  initialVisibleEventIds,
}: EventVisibilityEditorProps) {
  const [visibleEventIds, setVisibleEventIds] = useState<string[]>(
    initialVisibleEventIds,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleToggleEvent = (eventId: string) => {
    setVisibleEventIds((prev) => {
      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId);
      }

      return [...prev, eventId];
    });
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setMessage(null);

    const result = await updateInvitationVisibleEvents(
      invitationId,
      visibleEventIds,
    );

    setIsSubmitting(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save' });
    }
  };

  const hasChanges =
    JSON.stringify([...visibleEventIds].sort()) !==
    JSON.stringify([...initialVisibleEventIds].sort());

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {availableEvents.map((event) => (
          <label
            key={event.id}
            className="flex cursor-pointer items-start gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={visibleEventIds.includes(event.id)}
              onChange={() => handleToggleEvent(event.id)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-[#9e3f3f] focus:ring-[#9e3f3f]"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{event.name}</div>
            </div>
          </label>
        ))}
      </div>

      {message && (
        <div
          className={`rounded px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={!hasChanges || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
