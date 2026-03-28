/**
 * RFC 4180 CSV serialization utilities.
 *
 * Builds CSV output using only native string operations — no third-party
 * dependencies. All cells are double-quoted; double quotes within values are
 * escaped by doubling them. Line endings use CRLF (\r\n) per the RFC.
 */

/**
 * Wrap a single cell value in double quotes, escaping any embedded double
 * quotes by doubling them as required by RFC 4180.
 *
 * @param value - The raw cell value to escape.
 * @returns The RFC 4180-quoted cell string.
 */
export function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');

  return `"${escaped}"`;
}

/**
 * Serialize a table of string data to a RFC 4180 CSV string.
 *
 * All cells — including headers — are double-quoted. Null and undefined cell
 * values are treated as empty strings. Line endings are CRLF (\r\n).
 *
 * @param headers - Ordered list of column header labels.
 * @param rows - Array of data rows; each row must have the same length as headers.
 * @returns The complete CSV string including header row, data rows, and a
 *   trailing CRLF on the final row.
 */
export function serializeToCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) =>
    row.map((cell) => escapeCsvCell(cell ?? '')).join(','),
  );
  const allLines = [headerLine, ...dataLines];

  return allLines.map((line) => `${line}\r\n`).join('');
}
