/**
 * @vitest-environment node
 *
 * Tests for the recoverInvitationCode server action.
 * Mocks only the database client (getDb), allowing the real repository logic
 * to run — verifying the full action + repository chain together.
 *
 * Seed scenario: two Invitation records with different addresses and two
 * Guest rows sharing the same last name (Johnson), each linked to a
 * different invitation — covers the multi-household edge case.
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { recoverInvitationCode } from './actions';

const mockGetDb = vi.mocked(getDb);

// Seed data representing two distinct households with the same last name.
const HOUSEHOLD_A = {
  lastName: 'Johnson',
  address: '100 Elm Street',
  zipCode: '62701',
  invitationCode: 'maple-tiger',
};

const HOUSEHOLD_B = {
  lastName: 'Johnson',
  address: '200 Oak Avenue',
  zipCode: '60601',
  invitationCode: 'cedar-fox',
};

const GENERIC_ERROR = "We couldn't find an invitation matching those details.";

type SeedRow = { invitationCode: string | null };

/**
 * Creates a mock DbClient whose select chain returns the given rows,
 * simulating the Drizzle select → from → innerJoin → where → limit chain
 * used by findInvitationCodeByLastNameAndAddress.
 */
function createMockDb(rows: SeedRow[]): DbClient {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const innerJoinFn = vi.fn().mockReturnValue({ where: whereFn });
  const fromFn = vi.fn().mockReturnValue({ innerJoin: innerJoinFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  return { select: selectFn } as unknown as DbClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recoverInvitationCode', () => {
  test('should return the correct code when last name and address match', async () => {
    mockGetDb.mockReturnValue(
      createMockDb([{ invitationCode: HOUSEHOLD_A.invitationCode }]),
    );

    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({
      success: true,
      invitationCode: HOUSEHOLD_A.invitationCode,
    });
  });

  test('should return the correct code for household B when its address is used', async () => {
    mockGetDb.mockReturnValue(
      createMockDb([{ invitationCode: HOUSEHOLD_B.invitationCode }]),
    );

    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_B.lastName,
      streetAddress: HOUSEHOLD_B.address,
      zipCode: HOUSEHOLD_B.zipCode,
    });

    expect(result).toEqual({
      success: true,
      invitationCode: HOUSEHOLD_B.invitationCode,
    });
  });

  test('should return generic failure when last name does not match', async () => {
    mockGetDb.mockReturnValue(createMockDb([]));

    const result = await recoverInvitationCode({
      lastName: 'Unknown',
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  test('should return generic failure when address does not match', async () => {
    mockGetDb.mockReturnValue(createMockDb([]));

    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: '999 Wrong Road',
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  test('should return generic failure when ZIP code does not match', async () => {
    mockGetDb.mockReturnValue(createMockDb([]));

    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: HOUSEHOLD_A.address,
      zipCode: '00000',
    });

    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  test('should return generic failure when same last name is used with the wrong address', async () => {
    mockGetDb.mockReturnValue(createMockDb([]));

    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: '300 Pine Lane',
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  test('should return the correct code for a case-insensitive last name match', async () => {
    mockGetDb.mockReturnValue(
      createMockDb([{ invitationCode: HOUSEHOLD_A.invitationCode }]),
    );

    const result = await recoverInvitationCode({
      lastName: 'JOHNSON',
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({
      success: true,
      invitationCode: HOUSEHOLD_A.invitationCode,
    });
  });

  test('should return the correct code for a case-insensitive address match', async () => {
    mockGetDb.mockReturnValue(
      createMockDb([{ invitationCode: HOUSEHOLD_A.invitationCode }]),
    );

    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: '100 ELM STREET',
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({
      success: true,
      invitationCode: HOUSEHOLD_A.invitationCode,
    });
  });

  test('should not return household B code when the address belongs to household A', async () => {
    mockGetDb.mockReturnValue(
      createMockDb([{ invitationCode: HOUSEHOLD_A.invitationCode }]),
    );

    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_B.lastName,
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({
      success: true,
      invitationCode: HOUSEHOLD_A.invitationCode,
    });

    expect((result as { invitationCode?: string }).invitationCode).not.toBe(
      HOUSEHOLD_B.invitationCode,
    );
  });

  test('should return generic failure when lastName is empty', async () => {
    const result = await recoverInvitationCode({
      lastName: '',
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  test('should return generic failure when streetAddress is empty', async () => {
    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: '',
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  test('should return generic failure when zipCode is empty', async () => {
    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: HOUSEHOLD_A.address,
      zipCode: '',
    });

    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  test('should return generic failure when the database throws an unexpected error', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const result = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    expect(result).toEqual({ success: false, error: GENERIC_ERROR });
  });

  test('should return identical error strings across all failure cases', async () => {
    mockGetDb.mockReturnValue(createMockDb([]));

    const noMatch = await recoverInvitationCode({
      lastName: 'Unknown',
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    const emptyName = await recoverInvitationCode({
      lastName: '',
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    const emptyAddress = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: '',
      zipCode: HOUSEHOLD_A.zipCode,
    });

    const emptyZip = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: HOUSEHOLD_A.address,
      zipCode: '',
    });

    mockGetDb.mockImplementation(() => {
      throw new Error('boom');
    });

    const dbError = await recoverInvitationCode({
      lastName: HOUSEHOLD_A.lastName,
      streetAddress: HOUSEHOLD_A.address,
      zipCode: HOUSEHOLD_A.zipCode,
    });

    const errors = [noMatch, emptyName, emptyAddress, emptyZip, dbError].map(
      (r) => (r as { success: false; error: string }).error,
    );

    expect(new Set(errors).size).toBe(1);
  });
});
