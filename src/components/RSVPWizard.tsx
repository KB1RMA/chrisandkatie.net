'use client';

/**
 * RSVPWizard: multi-step wizard for the RSVP flow.
 *
 * Step 1 – Confirm or update the invitation address.
 * Step 2 – Attendance and meal selections for each guest.
 * Step 3 – Additional events the invitation holder is invited to.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { RSVPForm, type GuestRSVP } from '@/components/RSVPForm';
import { EventRsvpCard } from '@/components/EventRsvpCard';
import { Button } from '@/components/Button';
import { updateInvitationAddress } from '@/app/rsvp/(portal)/actions';
import {
  updateInvitationAddressSchema,
  type UpdateInvitationAddressInput,
} from '@/lib/schemas/rsvp';
import { MEAL_CHOICE_LABELS } from '@/lib/constants';
import type { WeddingEvent, RsvpResponse } from '@/lib/db/schema';

export type InvitationAddress = {
  mailingAddress: string | null;
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

type AdditionalEvent = {
  event: WeddingEvent;
  rsvp: RsvpResponse | null;
};

/**
 * Zod schema for the address step form fields (excludes invitationId, which is
 * injected programmatically on submit).
 */
const addressStepSchema = updateInvitationAddressSchema.omit({
  invitationId: true,
});

type AddressStepFormData = Omit<UpdateInvitationAddressInput, 'invitationId'>;

export type RSVPWizardProps = {
  invitationId: string;
  address: InvitationAddress;
  guests: GuestRSVP[];
  isSubmitted: boolean;
  submittedAt: string | null;
  contactEmail: string | null;
  additionalEvents: AdditionalEvent[];
};

const STEP_LABELS = [
  'Confirm Address',
  'Your RSVP',
  'Additional Events',
] as const;

/**
 * Step progress indicator displayed at the top of the wizard.
 *
 * @param currentStep - The currently active step number (1-indexed).
 * @param onStepClick - Called with the step number when a navigable step is clicked.
 * @param isStepClickable - Returns true for steps the user is allowed to jump to.
 */
function StepIndicator({
  currentStep,
  onStepClick,
  isStepClickable,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
  isStepClickable: (step: number) => boolean;
}) {
  return (
    <div className="mb-8 flex items-center justify-center">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        const clickable = isStepClickable(stepNum);

        return (
          <div key={label} className="flex items-center">
            <button
              type="button"
              onClick={() => clickable && onStepClick(stepNum)}
              disabled={!clickable}
              aria-current={isActive ? 'step' : undefined}
              className={`flex flex-col items-center ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  isCompleted
                    ? 'bg-[#9e3f3f] text-white'
                    : isActive
                      ? 'border-2 border-[#9e3f3f] text-[#9e3f3f]'
                      : 'border-2 border-gray-300 text-gray-400'
                }`}
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              <span
                className={`mt-1 text-xs ${
                  isActive ? 'font-medium text-[#9e3f3f]' : 'text-gray-500'
                }`}
              >
                {label}
              </span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`mx-2 mb-5 h-px w-10 transition-colors sm:w-16 ${
                  isCompleted ? 'bg-[#9e3f3f]' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

type AddressStepProps = {
  invitationId: string;
  address: InvitationAddress;
  contactEmail: string | null;
  onConfirm: () => void;
};

/**
 * Step 1: Display the invitation address and optionally allow the guest to
 * correct it before proceeding.
 *
 * @param invitationId - ID of the invitation to update.
 * @param address - Current address fields from the invitation record.
 * @param contactEmail - Existing contact email on record.
 * @param onConfirm - Called when the guest confirms or saves the address.
 */
function AddressStep({
  invitationId,
  address,
  contactEmail,
  onConfirm,
}: AddressStepProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressStepFormData>({
    resolver: zodResolver(addressStepSchema),
    defaultValues: {
      mailingAddress: address.mailingAddress ?? '',
      address: address.address ?? '',
      addressLine2: address.addressLine2 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      zipCode: address.zipCode ?? '',
      contactEmail: contactEmail ?? '',
    },
  });

  const hasAddress = address.address || address.city || address.mailingAddress;

  /**
   * Submit the address form, calling the updateInvitationAddress server action.
   * Handles both the "confirm" flow (no edits) and the "save" flow (user edited fields).
   *
   * @param data - Validated form data from react-hook-form.
   */
  async function onSubmit(data: AddressStepFormData) {
    setSaveError(null);

    try {
      await updateInvitationAddress({
        invitationId,
        mailingAddress: data.mailingAddress || null,
        address: data.address || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        contactEmail: data.contactEmail || null,
      });
      router.refresh();

      if (showEdit) {
        // Return to the confirm view so the guest can review their saved changes.
        setShowEdit(false);
      } else {
        onConfirm();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save.');
    }
  }

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#9e3f3f] focus:ring-2 focus:ring-[#9e3f3f] focus:outline-none';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div>
        <h2 className="mb-1 text-xl font-medium text-gray-900">
          Confirm Your Address
        </h2>
        <p className="text-sm text-gray-600">
          Please verify the address below is correct — this is what we have on
          file for your invitation.
        </p>
      </div>

      {hasAddress ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
          {address.mailingAddress && (
            <p className="font-medium">{address.mailingAddress}</p>
          )}
          {address.address && <p>{address.address}</p>}
          {address.addressLine2 && <p>{address.addressLine2}</p>}
          {(address.city || address.state) && (
            <p>
              {[address.city, address.state].filter(Boolean).join(', ')}{' '}
              {address.zipCode}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No address on file.</p>
      )}

      {!showEdit && (
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="text-sm text-[#9e3f3f] underline underline-offset-2 hover:text-[#b76565]"
        >
          Something looks wrong? Update address
        </button>
      )}

      {/* Contact email — always visible */}
      <div>
        <label
          htmlFor="contactEmail"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Contact Email{' '}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">
          We&apos;ll only use this to follow up about your RSVP if needed.
        </p>
        <input
          id="contactEmail"
          type="email"
          autoComplete="email"
          placeholder="your@email.com"
          aria-describedby={
            errors.contactEmail ? 'contactEmail-error' : undefined
          }
          aria-invalid={errors.contactEmail ? true : undefined}
          className={`${inputClass}${errors.contactEmail ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
          {...register('contactEmail')}
        />
        {errors.contactEmail && (
          <p id="contactEmail-error" className="mt-1 text-sm text-red-600">
            {errors.contactEmail.message}
          </p>
        )}
      </div>

      {showEdit && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-700">
            Update your address:
          </p>

          <div>
            <label
              htmlFor="edit-mailingAddress"
              className="mb-1 block text-xs text-gray-500"
            >
              Name on invitation
            </label>
            <input
              id="edit-mailingAddress"
              type="text"
              placeholder="e.g., The Smith Family"
              className={inputClass}
              {...register('mailingAddress')}
            />
          </div>

          <div>
            <label
              htmlFor="edit-address"
              className="mb-1 block text-xs text-gray-500"
            >
              Street address
            </label>
            <input
              id="edit-address"
              type="text"
              placeholder="123 Main St"
              className={inputClass}
              {...register('address')}
            />
          </div>

          <div>
            <label
              htmlFor="edit-addressLine2"
              className="mb-1 block text-xs text-gray-500"
            >
              Apt / Suite (optional)
            </label>
            <input
              id="edit-addressLine2"
              type="text"
              placeholder="Apt 4B"
              className={inputClass}
              {...register('addressLine2')}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label
                htmlFor="edit-city"
                className="mb-1 block text-xs text-gray-500"
              >
                City
              </label>
              <input
                id="edit-city"
                type="text"
                placeholder="Boston"
                className={inputClass}
                {...register('city')}
              />
            </div>
            <div className="w-20">
              <label
                htmlFor="edit-state"
                className="mb-1 block text-xs text-gray-500"
              >
                State
              </label>
              <input
                id="edit-state"
                type="text"
                placeholder="MA"
                className={inputClass}
                {...register('state')}
              />
            </div>
            <div className="w-24">
              <label
                htmlFor="edit-zipCode"
                className="mb-1 block text-xs text-gray-500"
              >
                ZIP
              </label>
              <input
                id="edit-zipCode"
                type="text"
                placeholder="02101"
                className={inputClass}
                {...register('zipCode')}
              />
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Saving…' : 'Save & Continue'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowEdit(false);
                setSaveError(null);
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showEdit && (
        <>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Saving\u2026' : 'Looks correct \u2014 continue'}
          </Button>
        </>
      )}
    </form>
  );
}

type EventsStepProps = {
  additionalEvents: AdditionalEvent[];
  onBack: () => void;
};

/**
 * Step 3: Shows additional event invitations for the guest to RSVP to.
 * Displays an all-done message when no additional events exist.
 *
 * @param additionalEvents - Events with existing RSVP status.
 * @param onBack - Called when the guest wants to go back to step 2.
 */
function EventsStep({ additionalEvents, onBack }: EventsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-xl font-medium text-gray-900">
          Additional Events
        </h2>
        {additionalEvents.length > 0 ? (
          <p className="text-sm text-gray-600">
            You&apos;re invited to the following events. Let us know if you can
            make it!
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            No additional events to RSVP to right now.
          </p>
        )}
      </div>

      {additionalEvents.length > 0 ? (
        <div className="space-y-3">
          {additionalEvents.map(({ event, rsvp }) => (
            <EventRsvpCard key={event.id} event={event} rsvp={rsvp} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-lg font-medium text-green-800">
            🎉 You&apos;re all set!
          </p>
          <p className="mt-1 text-sm text-green-700">
            Thank you for your RSVP. We can&apos;t wait to celebrate with you!
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700"
      >
        ← Back to RSVP
      </button>
    </div>
  );
}

type RsvpSummaryProps = {
  guests: GuestRSVP[];
  submittedAt: string | null;
  onEdit: () => void;
  onViewEvents: () => void;
};

/**
 * Collapsed view of a previously submitted RSVP.
 *
 * Shows each guest's name, attendance status, and meal choice.
 * An "Edit responses" button expands the full form.
 *
 * @param guests - Guest list with current responses.
 * @param submittedAt - ISO timestamp of the last submission.
 * @param onEdit - Called when the guest clicks to edit.
 * @param onViewEvents - Called when the guest clicks to view additional events.
 */
function RsvpSummary({
  guests,
  submittedAt,
  onEdit,
  onViewEvents,
}: RsvpSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-amber-400 bg-amber-50 px-4 py-4 text-amber-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-medium">✓ You&#39;ve already submitted</p>
            {submittedAt && (
              <p className="text-sm">
                Your responses were last updated on{' '}
                <strong>
                  {new Date(submittedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
                .
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onViewEvents}
            className="shrink-0 text-sm text-[#9e3f3f] underline underline-offset-2 hover:text-[#b76565]"
          >
            Additional Events →
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {guests.map((guest) => {
          const displayName =
            guest.firstName.toLowerCase() === 'guest'
              ? 'Plus One'
              : `${guest.firstName} ${guest.lastName}`;

          return (
            <div
              key={guest.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-gray-900">{displayName}</p>
                {guest.attending && guest.mealChoice && (
                  <p className="text-sm text-gray-500">
                    {MEAL_CHOICE_LABELS[guest.mealChoice]}
                  </p>
                )}
                {guest.attending && guest.dietaryRestrictions && (
                  <p className="text-xs text-gray-400">
                    {guest.dietaryRestrictions}
                  </p>
                )}
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  guest.attending === true
                    ? 'bg-green-100 text-green-800'
                    : guest.attending === false
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {guest.attending === true
                  ? 'Attending'
                  : guest.attending === false
                    ? 'Declining'
                    : 'No response'}
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="text-sm text-[#9e3f3f] underline underline-offset-2 hover:text-[#b76565]"
      >
        Edit responses
      </button>
    </div>
  );
}

/**
 * Three-step RSVP wizard.
 *
 * When the RSVP has already been submitted, the wizard starts on step 2
 * so returning guests can update without re-confirming their address.
 *
 * @param props - Invitation data, guests, address, and additional events.
 */
export function RSVPWizard({
  invitationId,
  address,
  guests,
  isSubmitted,
  submittedAt,
  contactEmail,
  additionalEvents,
}: RSVPWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Support ?step=3 deep-link (e.g. returning from an additional-event RSVP).
  const stepParam = Number(searchParams.get('step'));
  const initialStep =
    stepParam >= 1 && stepParam <= 3 ? stepParam : isSubmitted ? 2 : 1;

  // Return visits start at step 2 — address was confirmed on first RSVP
  const [currentStep, setCurrentStep] = useState(initialStep);
  // Collapse the form when a prior RSVP exists; expand on edit
  const [isFormExpanded, setIsFormExpanded] = useState(!isSubmitted);

  // Capture at mount whether the URL had a ?step param so we can strip it once,
  // without re-running the effect every time searchParams changes.
  const hadStepParam = useRef(searchParams.has('step'));

  // Strip the ?step param from the URL once the wizard has consumed it.
  useEffect(() => {
    if (hadStepParam.current) {
      router.replace('/rsvp', { scroll: false });
    }
  }, [router]);

  const goForward = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, 3));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
    // Auto-expand the RSVP form when navigating back to step 2 so the guest
    // can immediately edit their responses rather than seeing the collapsed summary.
    setIsFormExpanded(true);
  }, []);

  const handleSubmitSuccess = useCallback(() => {
    setIsFormExpanded(false);
    goForward();
  }, [goForward]);

  return (
    <div>
      <StepIndicator
        currentStep={currentStep}
        onStepClick={setCurrentStep}
        isStepClickable={(step) =>
          step !== currentStep &&
          (step < currentStep || (step === 3 && isSubmitted))
        }
      />

      {currentStep === 1 && (
        <AddressStep
          invitationId={invitationId}
          address={address}
          contactEmail={contactEmail}
          onConfirm={goForward}
        />
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={goBack}
            className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700"
          >
            ← Back to address
          </button>

          {isSubmitted && !isFormExpanded ? (
            <RsvpSummary
              guests={guests}
              submittedAt={submittedAt ?? null}
              onEdit={() => setIsFormExpanded(true)}
              onViewEvents={goForward}
            />
          ) : (
            <RSVPForm
              invitationId={invitationId}
              guests={guests}
              isSubmitted={isSubmitted}
              submittedAt={submittedAt ?? undefined}
              onSubmitSuccess={handleSubmitSuccess}
            />
          )}
        </div>
      )}

      {currentStep === 3 && (
        <EventsStep additionalEvents={additionalEvents} onBack={goBack} />
      )}
    </div>
  );
}
