'use client';

import { useRef, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { eventFormSchema, type EventFormData } from '@/lib/schemas/event';
import { updateEvent } from '../actions';
import type { WeddingEvent } from '@/lib/db/schema';

type EventEditModalProps = {
  event: WeddingEvent;
  onClose: () => void;
};

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#9e3f3f] focus:outline-none focus:ring-1 focus:ring-[#9e3f3f]';
const LABEL_CLASS = 'text-sm font-medium text-gray-700';
const ERROR_CLASS = 'mt-1 text-xs text-red-600';

/**
 * Modal dialog for editing an existing wedding event.
 *
 * Uses the native `<dialog>` element and react-hook-form with Zod validation.
 * Calls the `updateEvent` server action on submit and refreshes the router on success.
 *
 * @param props.event - The current event data to pre-populate the form.
 * @param props.onClose - Callback invoked when the modal should be closed.
 * @returns A modal dialog containing the event edit form.
 */
export default function EventEditModal({
  event,
  onClose,
}: EventEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema) as Resolver<EventFormData>,
    defaultValues: {
      name: event.name,
      description: event.description ?? '',
      location: event.location ?? '',
      eventDate: event.eventDate,
      startTime: event.startTime,
      endTime: event.endTime,
      type: event.type as EventFormData['type'],
      dressCode: event.dressCode ?? '',
      parkingInfo: event.parkingInfo ?? '',
      sortOrder: event.sortOrder ?? 0,
    },
  });

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  /**
   * Handle close by calling the parent's onClose callback and closing the dialog.
   */
  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  /**
   * Submit the form, call the updateEvent server action, and handle success/failure.
   *
   * @param data - Validated form data from react-hook-form.
   */
  async function onSubmit(data: EventFormData) {
    setSubmitError(null);

    try {
      const result = await updateEvent({ id: event.id, ...data });

      if (!result.success) {
        setSubmitError(result.error);

        return;
      }

      router.refresh();
      onClose();
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.');
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl backdrop:bg-black/50"
      onClose={onClose}
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Event</h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="edit-name" className={LABEL_CLASS}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
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
            <label htmlFor="edit-description" className={LABEL_CLASS}>
              Description
            </label>
            <textarea
              id="edit-description"
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
            <label htmlFor="edit-location" className={LABEL_CLASS}>
              Location
            </label>
            <input
              id="edit-location"
              type="text"
              {...register('location')}
              className={INPUT_CLASS}
            />
            {errors.location && (
              <p className={ERROR_CLASS}>{errors.location.message}</p>
            )}
          </div>

          {/* Event Date */}
          <div>
            <label htmlFor="edit-eventDate" className={LABEL_CLASS}>
              Event Date <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-eventDate"
              type="date"
              {...register('eventDate')}
              className={INPUT_CLASS}
            />
            {errors.eventDate && (
              <p className={ERROR_CLASS}>{errors.eventDate.message}</p>
            )}
          </div>

          {/* Start / End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-startTime" className={LABEL_CLASS}>
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-startTime"
                type="time"
                {...register('startTime')}
                className={INPUT_CLASS}
              />
              {errors.startTime && (
                <p className={ERROR_CLASS}>{errors.startTime.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-endTime" className={LABEL_CLASS}>
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-endTime"
                type="time"
                {...register('endTime')}
                className={INPUT_CLASS}
              />
              {errors.endTime && (
                <p className={ERROR_CLASS}>{errors.endTime.message}</p>
              )}
            </div>
          </div>

          {/* Type */}
          <div>
            <label htmlFor="edit-type" className={LABEL_CLASS}>
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="edit-type"
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

          {/* Dress Code */}
          <div>
            <label htmlFor="edit-dressCode" className={LABEL_CLASS}>
              Dress Code
            </label>
            <input
              id="edit-dressCode"
              type="text"
              {...register('dressCode')}
              className={INPUT_CLASS}
            />
            {errors.dressCode && (
              <p className={ERROR_CLASS}>{errors.dressCode.message}</p>
            )}
          </div>

          {/* Parking Info */}
          <div>
            <label htmlFor="edit-parkingInfo" className={LABEL_CLASS}>
              Parking Info
            </label>
            <textarea
              id="edit-parkingInfo"
              rows={3}
              {...register('parkingInfo')}
              className={INPUT_CLASS}
            />
            {errors.parkingInfo && (
              <p className={ERROR_CLASS}>{errors.parkingInfo.message}</p>
            )}
          </div>

          {/* Sort Order */}
          <div>
            <label htmlFor="edit-sortOrder" className={LABEL_CLASS}>
              Sort Order
            </label>
            <input
              id="edit-sortOrder"
              type="number"
              {...register('sortOrder')}
              className={INPUT_CLASS}
            />
            {errors.sortOrder && (
              <p className={ERROR_CLASS}>{errors.sortOrder.message}</p>
            )}
          </div>
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
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
