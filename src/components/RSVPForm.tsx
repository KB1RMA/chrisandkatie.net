'use client';

/**
 * RSVP form component for guests to respond to invitation.
 *
 * Displays all guests on the invitation and allows updating attendance status.
 * Uses react-hook-form for state management and server action for submission.
 * Validates with Zod schemas shared with server action.
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import confetti from 'canvas-confetti';
import { submitRsvp } from '@/app/rsvp/(portal)/actions';
import { submitRsvpSchema, type SubmitRsvpInput } from '@/lib/schemas/rsvp';
import {
  MEAL_OPTIONS,
  MEAL_CHOICE_LABELS,
  MEAL_CHOICE_DESCRIPTIONS,
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
  /** Called after a successful submission — used by RSVPWizard to advance steps. */
  onSubmitSuccess?: () => void;
};

export function RSVPForm({
  invitationId,
  guests,
  isSubmitted = false,
  submittedAt,
  onSubmitSuccess,
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
        type: g.type,
        attending: g.attending ?? undefined,
        mealChoice: g.mealChoice,
        dietaryRestrictions: g.dietaryRestrictions || null,
        notes: g.notes,
      })),
    },
  });

  // Watch attending status for each guest to show meal selection conditionally
  const watchedAttending = watch('guests');

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

        // Advance to the next wizard step if a callback is provided
        onSubmitSuccess?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to submit RSVP';
        setError('root', { message: errorMessage });
      }
    },
    [router, setError, triggerConfetti, onSubmitSuccess],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {showSuccessMessage && (
        <div className="animate-in fade-in slide-in-from-top-4 rounded border border-green-400 bg-green-50 px-4 py-4 text-green-800 duration-500">
          <p className="mb-1 font-medium">🎉 RSVP Submitted Successfully!</p>
          <p className="text-sm">
            Thank you for your response! We&#39;re excited to celebrate with
            you.
          </p>
        </div>
      )}

      {isSubmitted && !showSuccessMessage && submittedAt && (
        <div className="rounded border border-amber-400 bg-amber-50 px-4 py-4 text-amber-800">
          <p className="mb-1 font-medium">✓ You&#39;ve already submitted</p>
          <p className="text-sm">
            Your responses were last updated on{' '}
            <strong>
              {new Date(submittedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </strong>
            . You can update your responses below.
          </p>
        </div>
      )}

      {errors.root && (
        <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {errors.root.message}
        </div>
      )}

      <div className="space-y-4">
        {guests.map((guest, index) => {
          const isAttending = watchedAttending[index]?.attending === true;
          const isChild = guest.type === 'child';

          return (
            <div
              key={guest.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  {guest.firstName.toLowerCase() === 'guest' ? (
                    <div className="w-full space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          placeholder="First Name"
                          {...register(`guests.${index}.firstName`)}
                          className="flex-1 rounded-md border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 focus:border-[#9e3f3f] focus:ring-2 focus:ring-[#9e3f3f] focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          {...register(`guests.${index}.lastName`)}
                          className="flex-1 rounded-md border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 focus:border-[#9e3f3f] focus:ring-2 focus:ring-[#9e3f3f] focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Plus One - Please enter your name
                      </p>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-medium text-gray-900">
                        {guest.firstName} {guest.lastName}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {guest.type}
                      </p>
                    </>
                  )}
                </div>

                <div
                  className={`flex w-full flex-col gap-2 sm:w-auto ${
                    errors.guests?.[index]?.attending
                      ? 'border-l-2 border-red-500 pl-2'
                      : ''
                  }`}
                >
                  <Controller
                    name={`guests.${index}.attending`}
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-row items-start gap-3 sm:flex-row sm:items-center sm:gap-2">
                        <label className="inline-flex cursor-pointer items-center">
                          <input
                            type="radio"
                            checked={field.value === true}
                            onChange={() => field.onChange(true)}
                            className="form-radio h-5 w-5 text-[#9e3f3f]"
                          />
                          <span className="ml-2 text-base whitespace-nowrap text-gray-700 sm:text-sm">
                            Attending
                          </span>
                        </label>

                        <label className="inline-flex cursor-pointer items-center">
                          <input
                            type="radio"
                            checked={field.value === false}
                            onChange={() => field.onChange(false)}
                            className="form-radio h-5 w-5 text-gray-400"
                          />
                          <span className="ml-2 text-base whitespace-nowrap text-gray-700 sm:text-sm">
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
                  {isChild ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Kids&#39; food options will be available to choose the
                      night of the event.
                    </p>
                  ) : (
                    <div>
                      <label className="mb-3 block text-base font-medium text-gray-700 sm:text-sm">
                        Meal Choice *
                      </label>
                      <Controller
                        name={`guests.${index}.mealChoice`}
                        control={control}
                        render={({ field }) => (
                          <div
                            className={`space-y-2 sm:space-y-3 ${
                              errors.guests?.[index]?.mealChoice
                                ? 'rounded-md border-2 border-red-300 bg-red-50 p-3'
                                : ''
                            }`}
                          >
                            {Object.entries(MEAL_OPTIONS).map(([, value]) => (
                              <label
                                key={value}
                                className="flex cursor-pointer items-start rounded border border-transparent p-3 hover:border-gray-200 hover:bg-gray-50 sm:p-2"
                              >
                                <input
                                  type="radio"
                                  checked={field.value === value}
                                  onChange={() => field.onChange(value)}
                                  className="form-radio mt-1 h-5 w-5 flex-shrink-0 text-[#9e3f3f]"
                                />
                                <span className="ml-3">
                                  <span className="block text-base font-medium text-gray-900 sm:text-sm">
                                    {MEAL_CHOICE_LABELS[value]}
                                  </span>
                                  <span className="block text-sm text-gray-500 sm:text-xs">
                                    {MEAL_CHOICE_DESCRIPTIONS[value]}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      />
                      {errors.guests?.[index]?.mealChoice && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.guests[index]?.mealChoice?.message}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor={`dietary-${guest.id}`}
                      className="mb-2 block text-base font-medium text-gray-700 sm:text-sm"
                    >
                      Allergies (optional)
                    </label>
                    <input
                      id={`dietary-${guest.id}`}
                      type="text"
                      placeholder="e.g., Nuts, Shellfish, Gluten"
                      {...register(`guests.${index}.dietaryRestrictions`)}
                      className="w-full rounded-md border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 focus:border-[#9e3f3f] focus:ring-2 focus:ring-[#9e3f3f] focus:outline-none"
                    />
                    {errors.guests?.[index]?.dietaryRestrictions && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.guests[index]?.dietaryRestrictions?.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting
            ? 'Submitting...'
            : isSubmitted
              ? 'Update RSVP'
              : 'Submit RSVP'}
        </Button>
      </div>
    </form>
  );
}
