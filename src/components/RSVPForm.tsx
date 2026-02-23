'use client';

/**
 * RSVP form component for guests to respond to invitation.
 *
 * Displays all guests on the invitation and allows updating attendance status.
 * Uses react-hook-form for state management and server action for submission.
 * Validates with Zod schemas shared with server action.
 */
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { submitRsvp } from '@/app/rsvp/actions';
import { submitRsvpSchema, type SubmitRsvpInput } from '@/lib/schemas/rsvp';
import {
  MEAL_OPTIONS,
  MEAL_CHOICE_LABELS,
  type MealOption,
} from '@/lib/constants';
import { Button } from '@/components/Button';

export type GuestRSVP = {
  id: string;
  firstName: string;
  lastName: string;
  type: 'adult' | 'child';
  attending: boolean | null;
  mealChoice: MealOption | null;
  notes: string | null;
};

type RSVPFormProps = {
  invitationId: string;
  guests: GuestRSVP[];
  isSubmitted?: boolean;
  submittedBy?: string;
  submittedAt?: string;
};

export function RSVPForm({
  invitationId,
  guests,
  isSubmitted = false,
  submittedBy,
  submittedAt,
}: RSVPFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { isSubmitting, errors },
    setError,
  } = useForm<SubmitRsvpInput>({
    resolver: zodResolver(submitRsvpSchema),
    defaultValues: {
      invitationId,
      guests: guests.map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        attending: g.attending ?? undefined,
        mealChoice: g.mealChoice,
        notes: g.notes,
      })),
    },
    disabled: isSubmitted,
  });

  // Watch attending status for each guest to show meal selection conditionally
  const watchedAttending = watch('guests');

  // Calculate summary counts
  const summary = useMemo(() => {
    const attending = watchedAttending.filter(
      (g) => g.attending === true,
    ).length;
    const declined = watchedAttending.filter(
      (g) => g.attending === false,
    ).length;
    const pending = watchedAttending.filter((g) => g.attending === null).length;

    return { attending, declined, pending };
  }, [watchedAttending]);

  /**
   * Handle form submission with server action.
   */
  const onSubmit = useCallback(
    async (data: SubmitRsvpInput) => {
      try {
        await submitRsvp(data);

        // Refresh the page to show updated data
        router.refresh();
        alert('RSVP submitted successfully!');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to submit RSVP';
        setError('root', { message: errorMessage });
      }
    },
    [router, setError],
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`space-y-6 ${isSubmitted ? 'opacity-60' : ''}`}
    >
      {isSubmitted && submittedBy && submittedAt && (
        <div className="bg-blue-50 border border-blue-400 text-blue-800 px-4 py-4 rounded">
          <p className="font-medium mb-1">✓ RSVP Submitted</p>
          <p className="text-sm">
            Submitted by <strong>{submittedBy}</strong> on{' '}
            <strong>
              {new Date(submittedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
          </p>
          <p className="text-xs text-blue-600 mt-2">
            To make changes, please contact us.
          </p>
        </div>
      )}

      {errors.root && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {errors.root.message}
        </div>
      )}

      <div className="space-y-4">
        {guests.map((guest, index) => {
          const isAttending = watchedAttending[index]?.attending === true;

          return (
            <div
              key={guest.id}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  {guest.firstName.toLowerCase() === 'guest' ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="First Name"
                          {...register(`guests.${index}.firstName`)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9e3f3f]"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          {...register(`guests.${index}.lastName`)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9e3f3f]"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Plus One - Please enter your name
                      </p>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-medium text-lg text-gray-900">
                        {guest.firstName} {guest.lastName}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {guest.type}
                      </p>
                    </>
                  )}
                </div>

                <div
                  className={`flex flex-col gap-2 ${
                    errors.guests?.[index]?.attending
                      ? 'border-l-2 border-red-500 pl-2'
                      : ''
                  }`}
                >
                  <Controller
                    name={`guests.${index}.attending`}
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            checked={field.value === true}
                            onChange={() => field.onChange(true)}
                            className="form-radio h-4 w-4 text-[#9e3f3f]"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Attending
                          </span>
                        </label>

                        <label className="inline-flex items-center ml-4">
                          <input
                            type="radio"
                            checked={field.value === false}
                            onChange={() => field.onChange(false)}
                            className="form-radio h-4 w-4 text-gray-400"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Declining
                          </span>
                        </label>
                      </div>
                    )}
                  />

                  {errors.guests?.[index]?.attending && (
                    <p className="text-xs text-red-600">
                      {errors.guests[index]?.attending?.message}
                    </p>
                  )}
                </div>
              </div>

              {isAttending && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meal Choice *
                    </label>
                    <Controller
                      name={`guests.${index}.mealChoice`}
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-2">
                          {Object.entries(MEAL_OPTIONS).map(([, value]) => (
                            <label
                              key={value}
                              className="flex items-center cursor-pointer"
                            >
                              <input
                                type="radio"
                                checked={field.value === value}
                                onChange={() => field.onChange(value)}
                                className="form-radio h-4 w-4 text-[#9e3f3f]"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {MEAL_CHOICE_LABELS[value]}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    />
                    {errors.guests?.[index]?.mealChoice && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.guests[index]?.mealChoice?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`notes-${guest.id}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Additional Notes (optional)
                    </label>
                    <textarea
                      id={`notes-${guest.id}`}
                      placeholder="Any special requests or information"
                      rows={2}
                      {...register(`guests.${index}.notes`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9e3f3f]"
                    />
                    {errors.guests?.[index]?.notes && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.guests[index]?.notes?.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            <span className="font-medium">{summary.attending}</span> attending
          </p>
          <p>
            <span className="font-medium">{summary.declined}</span> declining
          </p>
          {summary.pending > 0 && (
            <p>
              <span className="font-medium">{summary.pending}</span> not yet
              responded
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={isSubmitting || isSubmitted}
          className="flex-1"
        >
          {isSubmitted
            ? 'RSVP Already Submitted'
            : isSubmitting
              ? 'Submitting...'
              : 'Submit RSVP'}
        </Button>
      </div>
    </form>
  );
}
