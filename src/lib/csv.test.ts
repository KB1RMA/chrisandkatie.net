/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import { escapeCsvCell, serializeToCsv } from '@/lib/csv';

describe('escapeCsvCell', () => {
  test('should wrap a plain string in double quotes', () => {
    expect(escapeCsvCell('hello')).toBe('"hello"');
  });

  test('should escape double quotes by doubling them', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  test('should wrap a value containing a comma in double quotes', () => {
    expect(escapeCsvCell('Smith, John')).toBe('"Smith, John"');
  });

  test('should return an empty pair of double quotes for an empty string', () => {
    expect(escapeCsvCell('')).toBe('""');
  });

  test('should preserve unicode and accent characters', () => {
    expect(escapeCsvCell('Héloïse')).toBe('"Héloïse"');
  });
});

describe('serializeToCsv', () => {
  test('should produce a header row followed by data rows with CRLF line endings', () => {
    const headers = ['Name', 'City'];
    const rows = [['Alice Smith', 'Portland']];
    const result = serializeToCsv(headers, rows);

    expect(result).toBe('"Name","City"\r\n"Alice Smith","Portland"\r\n');
  });

  test('should produce only a header row when rows array is empty', () => {
    const result = serializeToCsv(['Name', 'City'], []);

    expect(result).toBe('"Name","City"\r\n');
  });

  test('should correctly escape cells containing commas', () => {
    const result = serializeToCsv(['Name'], [['Smith, John']]);

    expect(result).toBe('"Name"\r\n"Smith, John"\r\n');
  });

  test('should correctly escape cells containing double quotes', () => {
    const result = serializeToCsv(['Note'], [['He said "hello"']]);

    expect(result).toBe('"Note"\r\n"He said ""hello"""\r\n');
  });

  test('should handle null and undefined cell values as empty strings', () => {
    const result = serializeToCsv(
      ['A', 'B'],
      [[null as unknown as string, undefined as unknown as string]],
    );

    expect(result).toBe('"A","B"\r\n"",""\r\n');
  });

  test('should preserve unicode characters across multiple rows', () => {
    const result = serializeToCsv(
      ['Name'],
      [['Héloïse Dupont'], ['André García']],
    );

    expect(result).toBe('"Name"\r\n"Héloïse Dupont"\r\n"André García"\r\n');
  });
});
