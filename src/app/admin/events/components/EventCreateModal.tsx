'use client';

import { useRef, useState } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { eventFormSchema, type EventFormData } from '@/lib/schemas/event';
import { createEvent } from '../actions';
import LocationAutocomplete from './LocationAutocomplete';
import { Modal, type ModalHandle } from '@/components/admin/Modal';

type EventCreateModalProps = {
  onClose: () => void;
};

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#9e3f3f] focus:outline-none focus:ring-1 focus:ring-[#9e3f3f]';
const LABEL_CLASS = 'text-sm font-medium text-gray-700';
const ERROR_CLASS = 'mt-1 text-xs text-red-600';

/**
 * Modal dialog for creating a new wedding event.
 *
 * Uses the native `<dialog>` element and react-hook-form with Zod validation.
 * Calls the `createEvent` server action on submit and refreshes the router on success.
 *
 * @param props.onClose - Callback invoked when the modal should be closed.
 * @returns A modal dialog containing the event creation form.
 */
export default function EventCreateModal({ onClose }: EventCreateModalProps) {
  const modalRef = useRef<ModalHandle>(null);
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema) as Resolver<EventFormData>,
    defaultValues: {
      name: '',
      description: '',
      location: '',
      eventDate: '',
      startTime: '',
      endTime: '',
      type: 'other' as const,
      dressCode: '',
      parkingInfo: '',
      sortOrder: 0,
      rsvpRequired: false,
      inviteAllGuests: false,
    },
  });

  const eventType = watch('type');

  /**
   * Closes the dialog; the resulting native close event notifies the parent.
   */
  function handleClose() {
    modalRef.current?.close();
  }

  /**
   * Submit the form, call the createEvent server action, and handle success/failure.
   *
   * @param data - Validated form data from react-hook-form.
   */
  async function onSubmit(data: EventFormData) {
    setSubmitError(null);

    try {
      const result = await createEvent(data);

      if (!result.success) {
        setSubmitError(result.error);

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
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Create Event</h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="create-name" className={LABEL_CLASS}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="create-name"
              type="text"
              {...register('name')}
              className={INPUT_CLASS}
            />
            {errors.name && (
              <p className={ERROR_CLASS}>{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="create-description" className={LABEL_CLASS}>
              Description
            </label>
            <textarea
              id="create-description"
              rows={3}
              {...register('description')}
              className={INPUT_CLASS}
            />
            {errors.description && (
              <p className={ERROR_CLASS}>{errors.description.message}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label htmlFor="create-location" className={LABEL_CLASS}>
              Location
            </label>
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <LocationAutocomplete
                  id="create-location"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  className={INPUT_CLASS}
                />
              )}
            />
            {errors.location && (
              <p className={ERROR_CLASS}>{errors.location.message}</p>
            )}
          </div>

          {/* Event Date + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-eventDate" className={LABEL_CLASS}>
                Event Date <span className="text-red-500">*</span>
              </label>
              <input
                id="create-eventDate"
                type="date"
                {...register('eventDate')}
                className={INPUT_CLASS}
              />
              {errors.eventDate && (
                <p className={ERROR_CLASS}>{errors.eventDate.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="create-type" className={LABEL_CLASS}>
                Type <span className="text-red-500">*</span>
              </label>
              <select
                id="create-type"
                {...register('type')}
                className={INPUT_CLASS}
              >
                <option value="main">Main</option>
                <option value="rehearsal">Rehearsal</option>
                <option value="brunch">Brunch</option>
                <option value="other">Other</option>
              </select>
              {errors.type && (
                <p className={ERROR_CLASS}>{errors.type.message}</p>
              )}
            </div>
          </div>

          {/* Start Time + End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-startTime" className={LABEL_CLASS}>
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                id="create-startTime"
                type="time"
                {...register('startTime')}
                className={INPUT_CLASS}
              />
              {errors.startTime && (
                <p className={ERROR_CLASS}>{errors.startTime.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="create-endTime" className={LABEL_CLASS}>
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                id="create-endTime"
                type="time"
                {...register('endTime')}
                className={INPUT_CLASS}
              />
              {errors.endTime && (
                <p className={ERROR_CLASS}>{errors.endTime.message}</p>
              )}
            </div>
          </div>

          {/* Dress Code + Sort Order */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-dressCode" className={LABEL_CLASS}>
                Dress Code
              </label>
              <input
                id="create-dressCode"
                type="text"
                {...register('dressCode')}
                className={INPUT_CLASS}
              />
              {errors.dressCode && (
                <p className={ERROR_CLASS}>{errors.dressCode.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="create-sortOrder" className={LABEL_CLASS}>
                Sort Order
              </label>
              <input
                id="create-sortOrder"
                type="number"
                {...register('sortOrder')}
                className={INPUT_CLASS}
              />
              {errors.sortOrder && (
                <p className={ERROR_CLASS}>{errors.sortOrder.message}</p>
              )}
            </div>
          </div>

          {/* Parking Info */}
          <div>
            <label htmlFor="create-parkingInfo" className={LABEL_CLASS}>
              Parking Info
            </label>
            <textarea
              id="create-parkingInfo"
              rows={3}
              {...register('parkingInfo')}
              className={INPUT_CLASS}
            />
            {errors.parkingInfo && (
              <p className={ERROR_CLASS}>{errors.parkingInfo.message}</p>
            )}
          </div>

          {/* Invite all guests */}
          <div className="flex items-center gap-3">
            <input
              id="create-inviteAllGuests"
              type="checkbox"
              {...register('inviteAllGuests')}
              className="h-4 w-4 rounded border-gray-300 text-[#9e3f3f] focus:ring-[#9e3f3f]"
            />
            <label htmlFor="create-inviteAllGuests" className={LABEL_CLASS}>
              Invite all guests
            </label>
          </div>

          {/* RSVP Required toggle — hidden for main-type events; unregistered
               when hidden so the field is absent from the submit payload. */}
          {eventType !== 'main' && (
            <div className="flex items-center gap-3">
              <input
                id="create-rsvpRequired"
                type="checkbox"
                {...register('rsvpRequired', { shouldUnregister: true })}
                className="h-4 w-4 rounded border-gray-300 text-[#9e3f3f] focus:ring-[#9e3f3f]"
              />
              <label htmlFor="create-rsvpRequired" className={LABEL_CLASS}>
                RSVP Required
              </label>
            </div>
          )}
        </div>

        {submitError && (
          <p className="mt-4 text-sm text-red-600">{submitError}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b76565] disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create Event'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
