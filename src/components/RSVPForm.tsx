'use client';

/**
 * RSVP form component for guests to respond to invitation.
 *
 * Displays all guests on the invitation and allows updating attendance status.
 * Uses react-hook-form for state management and server action for submission.
 * Validates with Zod schemas shared with server action.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import confetti from 'canvas-confetti';
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
  dietaryRestrictions: string | null;
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
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

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
        dietaryRestrictions: g.dietaryRestrictions || null,
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
   * Trigger confetti animation.
   */
  const triggerConfetti = useCallback(() => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  }, []);

  /**
   * Handle form submission with server action.
   */
  const onSubmit = useCallback(
    async (data: SubmitRsvpInput) => {
      try {
        await submitRsvp(data);

        // Show success message
        setShowSuccessMessage(true);

        // Trigger confetti
        triggerConfetti();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Refresh the page to show updated data
        router.refresh();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to submit RSVP';
        setError('root', { message: errorMessage });
      }
    },
    [router, setError, triggerConfetti],
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`space-y-6 ${isSubmitted ? 'opacity-60' : ''}`}
    >
      {showSuccessMessage && (
        <div className="bg-green-50 border border-green-400 text-green-800 px-4 py-4 rounded animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="font-medium mb-1">🎉 RSVP Submitted Successfully!</p>
          <p className="text-sm">
            Thank you for your response! We&#39;re excited to celebrate with
            you.
          </p>
        </div>
      )}

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
              className="bg-white rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                <div>
                  {guest.firstName.toLowerCase() === 'guest' ? (
                    <div className="space-y-2 w-full">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="First Name"
                          {...register(`guests.${index}.firstName`)}
                          className="flex-1 px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9e3f3f] focus:border-[#9e3f3f]"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          {...register(`guests.${index}.lastName`)}
                          className="flex-1 px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9e3f3f] focus:border-[#9e3f3f]"
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
                  className={`flex flex-col gap-2 w-full sm:w-auto ${
                    errors.guests?.[index]?.attending
                      ? 'border-l-2 border-red-500 pl-2'
                      : ''
                  }`}
                >
                  <Controller
                    name={`guests.${index}.attending`}
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-row sm:flex-row items-start sm:items-center gap-3 sm:gap-2">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="radio"
                            checked={field.value === true}
                            onChange={() => field.onChange(true)}
                            className="form-radio h-5 w-5 text-[#9e3f3f]"
                          />
                          <span className="ml-2 text-base sm:text-sm text-gray-700 whitespace-nowrap">
                            Attending
                          </span>
                        </label>

                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="radio"
                            checked={field.value === false}
                            onChange={() => field.onChange(false)}
                            className="form-radio h-5 w-5 text-gray-400"
                          />
                          <span className="ml-2 text-base sm:text-sm text-gray-700 whitespace-nowrap">
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
                <div className="space-y-4">
                  <div>
                    <label className="block text-base sm:text-sm font-medium text-gray-700 mb-3">
                      Meal Choice *
                    </label>
                    <Controller
                      name={`guests.${index}.mealChoice`}
                      control={control}
                      render={({ field }) => (
                        <div
                          className={`space-y-2 sm:space-y-3 ${
                            errors.guests?.[index]?.mealChoice
                              ? 'p-3 border-2 border-red-300 rounded-md bg-red-50'
                              : ''
                          }`}
                        >
                          {Object.entries(MEAL_OPTIONS).map(([, value]) => (
                            <label
                              key={value}
                              className="flex items-center cursor-pointer p-3 sm:p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200"
                            >
                              <input
                                type="radio"
                                checked={field.value === value}
                                onChange={() => field.onChange(value)}
                                className="form-radio h-5 w-5 text-[#9e3f3f] flex-shrink-0"
                              />
                              <span className="ml-3 text-base sm:text-sm text-gray-900 font-medium">
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
                      htmlFor={`dietary-${guest.id}`}
                      className="block text-base sm:text-sm font-medium text-gray-700 mb-2"
                    >
                      Dietary Restrictions (optional)
                    </label>
                    <input
                      id={`dietary-${guest.id}`}
                      type="text"
                      placeholder="e.g., Gluten-free, Nut allergy, Vegan"
                      {...register(`guests.${index}.dietaryRestrictions`)}
                      className="w-full px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9e3f3f] focus:border-[#9e3f3f]"
                    />
                    {errors.guests?.[index]?.dietaryRestrictions && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.guests[index]?.dietaryRestrictions?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`notes-${guest.id}`}
                      className="block text-base sm:text-sm font-medium text-gray-700 mb-2"
                    >
                      Additional Notes (optional)
                    </label>
                    <textarea
                      id={`notes-${guest.id}`}
                      placeholder="Any special requests or information"
                      rows={3}
                      {...register(`guests.${index}.notes`)}
                      className="w-full px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9e3f3f] focus:border-[#9e3f3f]"
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
