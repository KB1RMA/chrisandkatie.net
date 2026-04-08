'use client';

/**
 * EventRsvpForm component for event-specific RSVP submission.
 *
 * Allows guests to indicate attendance and select meal options for
 * individual additional events (rehearsal, brunch, etc.).
 * Uses react-hook-form with Zod validation and the submitEventRsvp server action.
 */
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { submitEventRsvp } from '@/app/rsvp/(portal)/[eventId]/actions';
import {
  submitEventRsvpSchema,
  type SubmitEventRsvpInput,
  type AttendeeOutput,
} from '@/lib/schemas/rsvp';
import {
  EVENT_MEAL_OPTION_LABELS,
  RSVP_DEADLINE_DISPLAY,
} from '@/lib/constants';
import { Button } from '@/components/Button';

type InvitationGuest = {
  id: string;
  firstName: string;
  lastName: string;
};

type ExistingRsvp = {
  attendanceStatus: 'attending' | 'not_attending';
  specialRequests: string | null;
  attendees: AttendeeOutput[];
};

type EventRsvpFormProps = {
  eventId: string;
  guestId: string;
  invitationGuests: InvitationGuest[];
  existingRsvp: ExistingRsvp | null;
  deadlinePassed: boolean;
  eventName: string;
  /**
   * Event type. Determines whether meal choice, dietary restrictions,
   * and special requests are rendered. Only 'main' events collect these fields.
   */
  eventType: 'main' | 'rehearsal' | 'brunch' | 'other';
};

/**
 * Build the default attendees list from an existing RSVP or invitation guests.
 *
 * @param invitationGuests - All guests on the invitation.
 * @param existingRsvp - Existing RSVP response, if any.
 * @returns Pre-populated attendees for the form.
 */
function buildDefaultAttendees(
  invitationGuests: InvitationGuest[],
  existingRsvp: ExistingRsvp | null,
) {
  if (!existingRsvp || existingRsvp.attendanceStatus !== 'attending') {
    return [];
  }

  return existingRsvp.attendees.map((a) => ({
    name: a.name,
    mealOption: a.mealOption,
    dietaryRestrictions: a.dietaryRestrictions ?? '',
  }));
}

/**
 * Form for submitting or updating an event-specific RSVP.
 *
 * @param eventId - ID of the event being RSVP'd for.
 * @param guestId - ID of the authenticated guest.
 * @param invitationGuests - Pre-registered guests on the invitation.
 * @param existingRsvp - Guest's existing RSVP, or null if not yet submitted.
 * @param deadlinePassed - Whether the RSVP deadline has passed (locks form).
 * @param eventName - Display name of the event.
 * @param eventType - Type of event; controls whether meal/dietary/special fields render.
 */
export function EventRsvpForm({
  eventId,
  guestId,
  invitationGuests,
  existingRsvp,
  deadlinePassed,
  eventName,
  eventType,
}: EventRsvpFormProps) {
  const router = useRouter();

  const hasMealChoice = eventType === 'main';

  const {
    control,
    register,
    handleSubmit,
    watch,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<SubmitEventRsvpInput>({
    resolver: zodResolver(submitEventRsvpSchema),
    defaultValues: {
      guestId,
      eventId,
      attendanceStatus: existingRsvp?.attendanceStatus ?? undefined,
      attendees: buildDefaultAttendees(invitationGuests, existingRsvp),
      specialRequests: existingRsvp?.specialRequests ?? '',
    },
    disabled: deadlinePassed,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'attendees',
  });

  const attendanceStatus = watch('attendanceStatus');

  /**
   * Toggle a guest's inclusion in the attendees list.
   *
   * @param guest - The invitation guest to toggle.
   * @param isChecked - Whether the guest is being added (true) or removed (false).
   */
  const handleGuestToggle = useCallback(
    (guest: InvitationGuest, isChecked: boolean) => {
      if (isChecked) {
        append({
          name: `${guest.firstName} ${guest.lastName}`,
          mealOption: hasMealChoice ? 'option_a' : null,
          dietaryRestrictions: hasMealChoice ? '' : null,
        });
      } else {
        const index = fields.findIndex(
          (f) => f.name === `${guest.firstName} ${guest.lastName}`,
        );

        if (index !== -1) {
          remove(index);
        }
      }
    },
    [append, fields, remove],
  );

  /**
   * Submit the RSVP form via server action.
   *
   * @param data - Validated form data.
   */
  const onSubmit = useCallback(
    async (data: SubmitEventRsvpInput) => {
      try {
        await submitEventRsvp(data);
        router.push('/rsvp?step=3');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to submit RSVP';
        setError('root', { message });
      }
    },
    [router, setError],
  );

  if (deadlinePassed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="font-medium text-amber-800">RSVP Deadline Has Passed</p>
        <p className="mt-1 text-sm text-amber-700">
          The RSVP deadline was {RSVP_DEADLINE_DISPLAY}. Please contact us
          directly if you need to make changes.
        </p>
        {existingRsvp && (
          <p className="mt-2 text-sm text-amber-700">
            Your current status:{' '}
            <strong>
              {existingRsvp.attendanceStatus === 'attending'
                ? 'Attending'
                : 'Not Attending'}
            </strong>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {errors.root && (
        <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {errors.root.message}
        </div>
      )}

      {/* Attendance section */}
      <div>
        <p className="mb-3 font-medium text-gray-900">
          Will you be attending {eventName}?
        </p>

        <div className="space-y-2">
          <Controller
            name="attendanceStatus"
            control={control}
            render={({ field }) => (
              <>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 hover:border-gray-200 hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={field.value === 'attending'}
                    onChange={() => field.onChange('attending')}
                    className="h-5 w-5 text-[#9e3f3f]"
                  />
                  <span className="text-gray-700">Yes, I will attend</span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 hover:border-gray-200 hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={field.value === 'not_attending'}
                    onChange={() => field.onChange('not_attending')}
                    className="h-5 w-5 text-gray-400"
                  />
                  <span className="text-gray-700">No, I cannot make it</span>
                </label>
              </>
            )}
          />
        </div>

        {errors.attendanceStatus && (
          <p className="mt-1 text-sm text-red-600">
            {errors.attendanceStatus.message}
          </p>
        )}
      </div>

      {/* Attendee selection (shown when attending) */}
      {attendanceStatus === 'attending' && (
        <div>
          <p className="mb-3 font-medium text-gray-900">
            Who will be attending?
          </p>

          <div className="space-y-4">
            {invitationGuests.map((guest) => {
              const guestFullName = `${guest.firstName} ${guest.lastName}`;
              const attendeeIndex = fields.findIndex(
                (f) => f.name === guestFullName,
              );
              const isChecked = attendeeIndex !== -1;

              return (
                <div
                  key={guest.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        handleGuestToggle(guest, e.target.checked)
                      }
                      className="h-5 w-5 rounded text-[#9e3f3f]"
                    />
                    <span className="font-medium text-gray-900">
                      {guestFullName}
                    </span>
                  </label>

                  {isChecked && hasMealChoice && (
                    <div className="mt-4 space-y-3 pl-8">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Meal Choice *
                        </label>

                        <div className="space-y-2">
                          {(
                            Object.entries(EVENT_MEAL_OPTION_LABELS) as [
                              'option_a' | 'option_b',
                              string,
                            ][]
                          ).map(([value, label]) => (
                            <label
                              key={value}
                              className="flex cursor-pointer items-center gap-3 rounded border border-transparent p-2 hover:border-gray-200 hover:bg-gray-50"
                            >
                              <input
                                type="radio"
                                value={value}
                                {...register(
                                  `attendees.${attendeeIndex}.mealOption`,
                                )}
                                className="h-4 w-4 text-[#9e3f3f]"
                              />
                              <span className="text-sm text-gray-700">
                                {label}
                              </span>
                            </label>
                          ))}
                        </div>

                        {errors.attendees?.[attendeeIndex]?.mealOption && (
                          <p className="mt-1 text-xs text-red-600">
                            {
                              errors.attendees[attendeeIndex]?.mealOption
                                ?.message
                            }
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`dietary-${guest.id}`}
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          Dietary Restrictions (optional)
                        </label>
                        <input
                          id={`dietary-${guest.id}`}
                          type="text"
                          placeholder="e.g., Gluten-free, Nut allergy, Vegan"
                          {...register(
                            `attendees.${attendeeIndex}.dietaryRestrictions`,
                          )}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#9e3f3f] focus:ring-2 focus:ring-[#9e3f3f] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {errors.attendees?.root && (
            <p className="mt-2 text-sm text-red-600">
              {errors.attendees.root.message}
            </p>
          )}
        </div>
      )}

      {/* Special requests — only shown for main events */}
      {hasMealChoice && (
        <div>
          <label
            htmlFor="specialRequests"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Special Requests (optional)
          </label>
          <textarea
            id="specialRequests"
            placeholder="Any special accommodations or requests"
            rows={3}
            {...register('specialRequests')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#9e3f3f] focus:ring-2 focus:ring-[#9e3f3f] focus:outline-none"
          />
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting
          ? 'Submitting...'
          : existingRsvp
            ? 'Update RSVP'
            : 'Submit RSVP'}
      </Button>
    </form>
  );
}
