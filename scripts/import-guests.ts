#!/usr/bin/env tsx

/**
 * Import guest list from CSV into D1 database using Drizzle ORM.
 *
 * Usage:
 *   npm run db:seed
 *   npm run db:seed:d1 -- --env production
 *   npm run db:seed:local
 */

import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { InferInsertModel } from 'drizzle-orm';
import { invitations, guests } from '@/lib/db/schema';

type CSVRow = Record<string, string>;
type InvitationInsert = InferInsertModel<typeof invitations>;
type GuestInsert = InferInsertModel<typeof guests>;

/**
 * Generate invitation address based on guest composition.
 *
 * @param adults - Array of adult guests with firstName and lastName
 * @param hasChildren - Whether the invitation includes children
 * @returns Generated invitation address
 */
function generateInvitationAddress(
  adults: Array<{ firstName: string; lastName: string }>,
  hasChildren: boolean,
): string {
  // If there are children, use "The [last name] Family"
  if (hasChildren && adults.length > 0) {
    return `The ${adults[0].lastName} Family`;
  }

  // If only one adult
  if (adults.length === 1) {
    return `${adults[0].firstName} ${adults[0].lastName}`;
  }

  // If two adults
  if (adults.length === 2) {
    const [adult1, adult2] = adults;

    // Same last name: "First and Second LastName"
    if (adult1.lastName === adult2.lastName) {
      return `${adult1.firstName} and ${adult2.firstName} ${adult1.lastName}`;
    }

    // Different last names: both full names
    return `${adult1.firstName} ${adult1.lastName} and ${adult2.firstName} ${adult2.lastName}`;
  }

  // Fallback for more than 2 adults
  const names = adults.map((a) => `${a.firstName} ${a.lastName}`).join(' and ');

  return names;
}

/**
 * Parse a single CSV line respecting quoted values.
 *
 * @param line - CSV line to parse
 * @returns Array of parsed values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  values.push(currentValue.trim());

  return values;
}

/**
 * Map CSV values to header keys.
 *
 * @param headers - Array of header names
 * @param values - Array of values to map
 * @returns Object mapping headers to values
 */
const mapValuesToHeaders = (headers: string[]) => (values: string[]) =>
  headers.reduce(
    (acc, header, index) => ({
      ...acc,
      [header]: values[index] || '',
    }),
    {} as Record<string, string>,
  );

/**
 * Parse CSV file into array of objects.
 *
 * @param csvContent - Raw CSV file content
 * @returns Array of parsed CSV rows
 */
function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  const headers = lines[0].split(',');
  const mapper = mapValuesToHeaders(headers);

  return lines
    .slice(1)
    .map(parseCSVLine)
    .map(mapper)
    .map((row) => row as unknown as CSVRow);
}

/**
 * Extract all guests (adults and children) from a CSV row.
 *
 * @param row - CSV row object
 * @returns Array of guest objects
 */
const extractGuests = (row: CSVRow) => {
  const adults = [
    { firstName: row['First Name'], lastName: row['Last Name'] },
    ...(row['Partner First Name']
      ? [
          {
            firstName: row['Partner First Name'],
            lastName: row['Partner Last Name'] || '',
          },
        ]
      : []),
  ];

  const childKeys = [1, 2, 3, 4, 5] as const;
  const children = childKeys
    .map((num) => ({
      firstName: row[`Child ${num} First Name` as keyof CSVRow],
      lastName: row[`Child ${num} Last Name` as keyof CSVRow],
    }))
    .filter((child) => child.firstName);

  return [
    ...adults.map((guest) => ({
      ...guest,
      type: 'adult' as const,
    })),
    ...children.map((child) => ({
      ...child,
      type: 'child' as const,
    })),
  ];
};

/**
 * Format SQL value for INSERT statement.
 *
 * @param value - Value to format
 * @returns SQL-formatted value
 */
const formatSQLValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

/**
 * Build INSERT statement for Drizzle model.
 *
 * @param tableName - Database table name
 * @param columns - Column names
 * @param values - Values to insert
 * @returns SQL INSERT statement
 */
const buildInsertStatement = (
  tableName: string,
  columns: string[],
  values: unknown[],
): string => {
  const sqlValues = values.map(formatSQLValue).join(', ');
  const columnList = columns.map((col) => `"${col}"`).join(', ');

  return `INSERT INTO "${tableName}" (${columnList}) VALUES (${sqlValues});`;
};

/**
 * Create invitation and guest insert statements from CSV row.
 *
 * @param row - CSV row object
 * @param now - Current timestamp as ISO string
 * @returns Object with invitation and guest insert statements
 */
const createRowInsertStatements = (row: CSVRow, now: string) => {
  const invitationId = randomUUID();
  const guestList = extractGuests(row);
  const hasChildren = guestList.some((g) => g.type === 'child');
  const adults = guestList.filter(
    (g) => g.type === 'adult' && g.firstName.toLowerCase() !== 'guest',
  );
  const mailingAddress = generateInvitationAddress(adults, hasChildren);
  const totalInvited = parseInt(row['Total Definitely Invited']) || 1;

  // Build invitation insert
  const invitationData: InvitationInsert = {
    id: invitationId,
    relationshipToCouple: row['Relationship To Couple'] || null,
    totalInvited,
    address: row['Street Address'] || null,
    addressLine2: row['Street Address (line 2)'] || null,
    city: row['City'] || null,
    state: row['State / Region'] || null,
    zipCode: row['Zip / Postal Code'] || null,
    country: row['Country'] || null,
    mailingAddress,
    visibleEvents: '[0,1,2,3]',
    createdAt: now,
    updatedAt: now,
  };

  const invitationColumns = Object.keys(invitationData) as Array<
    keyof typeof invitationData
  >;
  const invitationValues = invitationColumns.map((col) => invitationData[col]);
  const invitationStatement = buildInsertStatement(
    'Invitation',
    invitationColumns,
    invitationValues,
  );

  // Build guest inserts
  const guestStatements = guestList.map((guest) => {
    const guestData: GuestInsert = {
      id: randomUUID(),
      invitationId,
      firstName: guest.firstName,
      lastName: guest.lastName,
      type: guest.type,
      createdAt: now,
      updatedAt: now,
    };

    const guestColumns = Object.keys(guestData) as Array<
      keyof typeof guestData
    >;
    const guestValues = guestColumns.map((col) => guestData[col]);

    return buildInsertStatement('Guest', guestColumns, guestValues);
  });

  return {
    invitationId,
    statements: [invitationStatement, ...guestStatements],
    guestCount: guestList.length,
  };
};

/**
 * Process a single CSV row into insert statements.
 *
 * @param now - Current timestamp as ISO string
 * @param row - CSV row object
 * @returns Object with statements array and row metadata
 */
const processRow = (now: string) => (row: CSVRow) => {
  const firstName = row['First Name'];
  const lastName = row['Last Name'];

  if (!firstName || !lastName) {
    return {
      success: false,
      invitationName: undefined,
      statements: [],
      guestCount: 0,
    };
  }

  const { statements, guestCount } = createRowInsertStatements(row, now);

  return {
    success: true,
    invitationName: `${firstName} ${lastName}`,
    statements,
    guestCount,
  };
};

/**
 * Aggregate results from processing rows.
 *
 * @param acc - Accumulator with running totals and statements
 * @param result - Result from processing a row
 * @returns Updated accumulator
 */
const aggregateResults = (
  acc: {
    statements: string[];
    invitationsCreated: number;
    guestsCreated: number;
    skipped: number;
    logs: string[];
  },
  result: ReturnType<ReturnType<typeof processRow>>,
) => {
  if (!result.success) {
    return {
      ...acc,
      skipped: acc.skipped + 1,
      logs: [...acc.logs, '⚠️  Skipping row with missing primary guest name'],
    };
  }

  return {
    statements: [...acc.statements, ...result.statements],
    invitationsCreated: acc.invitationsCreated + 1,
    guestsCreated: acc.guestsCreated + result.guestCount,
    skipped: acc.skipped,
    logs: [
      ...acc.logs,
      `✅ Invitation for ${result.invitationName} (${result.guestCount} guests)`,
    ],
  };
};

/**
 * Parse arguments to extract configuration.
 *
 * @returns Configuration object
 */
const parseArgs = () => ({
  shouldExecute:
    process.argv.includes('--remote') || process.argv.includes('--local'),
  isLocal: process.argv.includes('--local'),
  environment: process.argv[process.argv.indexOf('--env') + 1] ?? 'production',
});

/**
 * Build wrangler arguments for database execution.
 *
 * @param isLocal - Whether to execute locally
 * @param environment - Environment name
 * @param seedFilePath - Path to seed SQL file
 * @returns Array of wrangler command arguments
 */
const buildWranglerArgs = (
  isLocal: boolean,
  environment: string,
  seedFilePath: string,
) => {
  const baseArgs = [
    'd1',
    'execute',
    isLocal ? 'prisma-demo-db-local' : 'prisma-demo-db',
    '--file',
    seedFilePath,
  ];

  return isLocal
    ? [...baseArgs, '--local']
    : [...baseArgs, '--env', environment, '--remote'];
};

/**
 * Import guests from CSV file into database.
 */
async function importGuests() {
  console.log('🎉 Generating guest seed SQL...\n');

  const { shouldExecute, isLocal, environment } = parseArgs();
  const now = new Date().toISOString();

  // Read and parse CSV
  const csvPath = join(process.cwd(), 'seed-data', 'guest-list.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);

  console.log(`📋 Found ${rows.length} invitation records in CSV\n`);

  // Process all rows functionally
  const rowProcessor = processRow(now);
  const {
    statements: insertStatements,
    invitationsCreated,
    guestsCreated,
    skipped,
    logs,
  } = rows.reduce((acc, row) => aggregateResults(acc, rowProcessor(row)), {
    statements: [] as string[],
    invitationsCreated: 0,
    guestsCreated: 0,
    skipped: 0,
    logs: [] as string[],
  });

  // Log processing results
  logs.forEach((log) => console.log(log));

  // Write seed file
  const seedFilePath = join(process.cwd(), 'seed-data', 'guests-import.sql');
  const sqlFileContents = [
    'PRAGMA foreign_keys=OFF;',
    ...insertStatements,
    'PRAGMA foreign_keys=ON;',
  ].join('\n');

  writeFileSync(seedFilePath, sqlFileContents, 'utf-8');

  console.log(`\n🎊 Seed file created at ${seedFilePath}`);
  console.log(`   Invitations: ${invitationsCreated}`);
  console.log(`   Guests:      ${guestsCreated}`);
  console.log(`   Skipped:     ${skipped}`);

  if (!shouldExecute) {
    console.log('\nℹ️  Run with --remote or --local to import into D1.');

    return;
  }

  const dbName = isLocal ? 'prisma-demo-db-local' : 'prisma-demo-db';
  const execMode = isLocal ? 'local' : `remote (${environment})`;

  console.log(`\n🚀 Importing into D1 ${dbName} (${execMode})...`);
  const wranglerArgs = buildWranglerArgs(isLocal, environment, seedFilePath);

  execFileSync('wrangler', wranglerArgs, { stdio: 'inherit' });
}

// Run import
importGuests().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
