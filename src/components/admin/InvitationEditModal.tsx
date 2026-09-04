'use client';

import { useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  invitationEditSchema,
  type InvitationEditFormData,
} from '@/lib/schemas/invitation';
import { updateInvitationDetails } from '@/app/admin/invitations/actions';
import { Modal, type ModalHandle } from '@/components/admin/Modal';

type InvitationEditModalProps = {
  invitationId: string;
  defaultValues: InvitationEditFormData;
  onClose: () => void;
};

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#9e3f3f] focus:outline-none focus:ring-1 focus:ring-[#9e3f3f]';
const LABEL_CLASS = 'text-sm font-medium text-gray-700';
const ERROR_CLASS = 'mt-1 text-xs text-red-600';

/**
 * Modal dialog for editing an existing invitation's details.
 *
 * Uses the native `<dialog>` element and react-hook-form with Zod validation.
 * Calls the `updateInvitationDetails` server action on submit and refreshes
 * the router on success.
 *
 * @param props.invitationId - The ID of the invitation being edited.
 * @param props.defaultValues - The current invitation data to pre-populate the form.
 * @param props.onClose - Callback invoked when the modal should be closed.
 * @returns A modal dialog containing the invitation edit form.
 */
export default function InvitationEditModal({
  invitationId,
  defaultValues,
  onClose,
}: InvitationEditModalProps) {
  const modalRef = useRef<ModalHandle>(null);
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvitationEditFormData>({
    resolver: zodResolver(
      invitationEditSchema,
    ) as Resolver<InvitationEditFormData>,
    defaultValues,
  });

  function handleClose() {
    modalRef.current?.close();
  }

  /**
   * Submit the form, call the updateInvitationDetails server action, and
   * handle success/failure.
   *
   * @param data - Validated form data from react-hook-form.
   */
  async function onSubmit(data: InvitationEditFormData) {
    setSubmitError(null);

    try {
      const result = await updateInvitationDetails(invitationId, data);

      if (!result.success) {
        setSubmitError(result.error ?? 'Failed to save changes');

        return;
      }

      router.refresh();
      handleClose();
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.');
    }
  }

  return (
    <Modal
      ref={modalRef}
      onClose={onClose}
      className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl backdrop:bg-black/50"
      aria-labelledby="edit-invitation-title"
      aria-describedby="edit-invitation-description"
    >
      <h2
        id="edit-invitation-title"
        className="mb-4 text-lg font-semibold text-gray-900"
      >
        Edit Invitation
      </h2>
      <p id="edit-invitation-description" className="sr-only">
        Edit the details for this invitation. Changes are saved immediately on
        submit.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Mailing Address (display name) */}
          <div>
            <label htmlFor="edit-mailingAddress" className={LABEL_CLASS}>
              Mailing Address (Display Name){' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-mailingAddress"
              type="text"
              {...register('mailingAddress')}
              className={INPUT_CLASS}
            />
            {errors.mailingAddress && (
              <p className={ERROR_CLASS}>{errors.mailingAddress.message}</p>
            )}
          </div>

          {/* Relationship to Couple */}
          <div>
            <label htmlFor="edit-relationshipToCouple" className={LABEL_CLASS}>
              Relationship to Couple
            </label>
            <input
              id="edit-relationshipToCouple"
              type="text"
              {...register('relationshipToCouple')}
              className={INPUT_CLASS}
            />
          </div>

          {/* Total Invited */}
          <div>
            <label htmlFor="edit-totalInvited" className={LABEL_CLASS}>
              Total Invited <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-totalInvited"
              type="number"
              min={1}
              {...register('totalInvited')}
              className={INPUT_CLASS}
            />
            {errors.totalInvited && (
              <p className={ERROR_CLASS}>{errors.totalInvited.message}</p>
            )}
          </div>

          {/* Invitation Code */}
          <div>
            <label htmlFor="edit-invitationCode" className={LABEL_CLASS}>
              Invitation Code
            </label>
            <input
              id="edit-invitationCode"
              type="text"
              {...register('invitationCode')}
              className={INPUT_CLASS}
            />
            {errors.invitationCode && (
              <p className={ERROR_CLASS}>{errors.invitationCode.message}</p>
            )}
          </div>

          <hr className="border-gray-200" />
          <p className="text-sm font-semibold text-gray-700">Mailing Address</p>

          {/* Street Address */}
          <div>
            <label htmlFor="edit-address" className={LABEL_CLASS}>
              Street Address
            </label>
            <input
              id="edit-address"
              type="text"
              {...register('address')}
              className={INPUT_CLASS}
            />
          </div>

          {/* Address Line 2 */}
          <div>
            <label htmlFor="edit-addressLine2" className={LABEL_CLASS}>
              Address Line 2
            </label>
            <input
              id="edit-addressLine2"
              type="text"
              {...register('addressLine2')}
              className={INPUT_CLASS}
            />
          </div>

          {/* City / State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-city" className={LABEL_CLASS}>
                City
              </label>
              <input
                id="edit-city"
                type="text"
                {...register('city')}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="edit-state" className={LABEL_CLASS}>
                State / Region
              </label>
              <input
                id="edit-state"
                type="text"
                {...register('state')}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Zip / Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-zipCode" className={LABEL_CLASS}>
                Zip / Postal Code
              </label>
              <input
                id="edit-zipCode"
                type="text"
                {...register('zipCode')}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="edit-country" className={LABEL_CLASS}>
                Country
              </label>
              <input
                id="edit-country"
                type="text"
                {...register('country')}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        {submitError && (
          <p className="mt-4 text-sm text-red-600">{submitError}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8a3535] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
