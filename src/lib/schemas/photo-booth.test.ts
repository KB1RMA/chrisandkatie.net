/**
 * @vitest-environment node
 */

import { expect, test, describe } from 'vitest';
import {
  uploadPhotoSchema,
  deletePhotoSchema,
  restorePhotoSchema,
  photoAlbumMessageSchema,
} from './photo-booth';

// ---------------------------------------------------------------------------
// uploadPhotoSchema
// ---------------------------------------------------------------------------

describe('uploadPhotoSchema', () => {
  test('should accept valid input with all fields', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: '123e4567-e89b-12d3-a456-426614174000',
      eventId: 'event-wedding-main',
      takenAt: '2024-06-15T14:30:00+00:00',
      width: 1920,
      height: 1080,
    });

    expect(result.success).toBe(true);
  });

  test('should accept valid input with only required fields', () => {
    const result = uploadPhotoSchema.safeParse({
      eventId: 'event-wedding-main',
    });

    expect(result.success).toBe(true);
  });

  test('should reject when eventId is missing', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(false);
  });

  test('should reject when eventId is an empty string', () => {
    const result = uploadPhotoSchema.safeParse({
      eventId: '',
    });

    expect(result.success).toBe(false);
  });

  test('should reject an invalid guestId that is not a uuid', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: 'not-a-uuid',
      eventId: 'event-wedding-main',
    });

    expect(result.success).toBe(false);
  });

  test('should reject an invalid takenAt that is not a datetime', () => {
    const result = uploadPhotoSchema.safeParse({
      eventId: 'event-wedding-main',
      takenAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });

  test('should reject a negative width', () => {
    const result = uploadPhotoSchema.safeParse({
      eventId: 'event-wedding-main',
      width: -100,
    });

    expect(result.success).toBe(false);
  });

  test('should reject a negative height', () => {
    const result = uploadPhotoSchema.safeParse({
      eventId: 'event-wedding-main',
      height: -50,
    });

    expect(result.success).toBe(false);
  });

  test('should reject zero width', () => {
    const result = uploadPhotoSchema.safeParse({
      eventId: 'event-wedding-main',
      width: 0,
    });

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deletePhotoSchema
// ---------------------------------------------------------------------------

describe('deletePhotoSchema', () => {
  test('should accept a valid photoId uuid', () => {
    const result = deletePhotoSchema.safeParse({
      photoId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(true);
  });

  test('should reject a photoId that is not a uuid', () => {
    const result = deletePhotoSchema.safeParse({
      photoId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  test('should reject when photoId is missing', () => {
    const result = deletePhotoSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// restorePhotoSchema
// ---------------------------------------------------------------------------

describe('restorePhotoSchema', () => {
  test('should accept a valid photoId uuid', () => {
    const result = restorePhotoSchema.safeParse({
      photoId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(true);
  });

  test('should reject a photoId that is not a uuid', () => {
    const result = restorePhotoSchema.safeParse({
      photoId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// photoAlbumMessageSchema
// ---------------------------------------------------------------------------

describe('photoAlbumMessageSchema', () => {
  const validPhoto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    publicUrl: 'https://photos.example.com/a.jpg',
    width: 1920,
    height: 1080,
    uploadedAt: '2026-07-16T12:00:00.000Z',
  };

  test('should accept a photo-added message with full photo data', () => {
    const result = photoAlbumMessageSchema.safeParse({
      type: 'photo-added',
      photo: validPhoto,
    });

    expect(result.success).toBe(true);
  });

  test('should accept a photo-added message without dimensions', () => {
    const result = photoAlbumMessageSchema.safeParse({
      type: 'photo-added',
      photo: {
        id: validPhoto.id,
        publicUrl: validPhoto.publicUrl,
        uploadedAt: validPhoto.uploadedAt,
      },
    });

    expect(result.success).toBe(true);
  });

  test('should accept a photo-added message with null dimensions', () => {
    const result = photoAlbumMessageSchema.safeParse({
      type: 'photo-added',
      photo: { ...validPhoto, width: null, height: null },
    });

    expect(result.success).toBe(true);
  });

  test('should accept a photo-removed message', () => {
    const result = photoAlbumMessageSchema.safeParse({
      type: 'photo-removed',
      photoId: validPhoto.id,
    });

    expect(result.success).toBe(true);
  });

  test('should reject an unknown message type', () => {
    const result = photoAlbumMessageSchema.safeParse({
      type: 'photo-updated',
      photo: validPhoto,
    });

    expect(result.success).toBe(false);
  });

  test('should reject a photo-added message missing the photo payload', () => {
    const result = photoAlbumMessageSchema.safeParse({
      type: 'photo-added',
    });

    expect(result.success).toBe(false);
  });

  test('should reject a photo-added message with an empty publicUrl', () => {
    const result = photoAlbumMessageSchema.safeParse({
      type: 'photo-added',
      photo: { ...validPhoto, publicUrl: '' },
    });

    expect(result.success).toBe(false);
  });

  test('should reject a photo-removed message missing photoId', () => {
    const result = photoAlbumMessageSchema.safeParse({
      type: 'photo-removed',
    });

    expect(result.success).toBe(false);
  });
});
