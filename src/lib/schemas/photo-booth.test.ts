/**
 * @vitest-environment node
 */

import { expect, test, describe } from 'vitest';
import {
  uploadPhotoSchema,
  deletePhotoSchema,
  restorePhotoSchema,
} from './photo-booth';

// ---------------------------------------------------------------------------
// uploadPhotoSchema
// ---------------------------------------------------------------------------

describe('uploadPhotoSchema', () => {
  test('should accept valid input with all fields', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: '123e4567-e89b-12d3-a456-426614174000',
      takenAt: '2024-06-15T14:30:00+00:00',
      width: 1920,
      height: 1080,
    });

    expect(result.success).toBe(true);
  });

  test('should accept valid input with only required fields', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result.success).toBe(true);
  });

  test('should reject an invalid guestId that is not a uuid', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  test('should reject an invalid takenAt that is not a datetime', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: '123e4567-e89b-12d3-a456-426614174000',
      takenAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });

  test('should reject a negative width', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: '123e4567-e89b-12d3-a456-426614174000',
      width: -100,
    });

    expect(result.success).toBe(false);
  });

  test('should reject a negative height', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: '123e4567-e89b-12d3-a456-426614174000',
      height: -50,
    });

    expect(result.success).toBe(false);
  });

  test('should reject zero width', () => {
    const result = uploadPhotoSchema.safeParse({
      guestId: '123e4567-e89b-12d3-a456-426614174000',
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
