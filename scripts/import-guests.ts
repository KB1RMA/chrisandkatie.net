#!/usr/bin/env tsx

/**
 * Generate SQL seed file from Zola CSV data and optionally import into D1.
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

interface CSVRow {
  'Total Definitely Invited': string;
  'First Name': string;
  'Last Name': string;
  'Partner First Name': string;
  'Partner Last Name': string;
  'Relationship To Couple': string;
  'Street Address': string;
  'Street Address (line 2)': string;
  City: string;
  'State / Region': string;
  'Zip / Postal Code': string;
  Country: string;
  'Child 1 First Name': string;
  'Child 1 Last Name': string;
  'Child 2 First Name': string;
  'Child 2 Last Name': string;
  'Child 3 First Name': string;
  'Child 3 Last Name': string;
  'Child 4 First Name': string;
  'Child 4 Last Name': string;
  'Child 5 First Name': string;
  'Child 5 Last Name': string;
}

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
 * Parse CSV file into array of objects.
 *
 * @param csvContent - Raw CSV file content
 * @returns Array of parsed CSV rows
 */
function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  const headers = lines[0].split(',');

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    // Parse CSV line respecting quoted values
    for (const char of lines[i]) {
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

    // Map values to headers
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    rows.push(row as unknown as CSVRow);
  }

  return rows;
}

/**
 * Import guests from CSV file into database.
 */
async function importGuests() {
  const shouldExecute =
    process.argv.includes('--remote') || process.argv.includes('--local');
  const isLocal = process.argv.includes('--local');
  const envIndex = process.argv.indexOf('--env');
  const environment =
    envIndex !== -1 ? process.argv[envIndex + 1] : 'production';
  const now = Date.now();

  console.log('🎉 Generating guest seed SQL...\n');

  // Read CSV file (use guest-list.csv which includes children)
  const csvPath = join(process.cwd(), 'seed-data', 'guest-list.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);

  console.log(`📋 Found ${rows.length} invitation records in CSV\n`);

  let invitationsCreated = 0;
  let guestsCreated = 0;
  let skipped = 0;
  const insertStatements: string[] = [];

  for (const row of rows) {
    const firstName = row['First Name'];
    const lastName = row['Last Name'];

    if (!firstName || !lastName) {
      console.log(`⚠️  Skipping row with missing primary guest name`);
      skipped++;
      continue;
    }

    const invitationId = randomUUID();
    const totalInvited = parseInt(row['Total Definitely Invited']) || 1;

    // Create Guest records for this invitation
    const guests: Array<{
      firstName: string;
      lastName: string;
      type: 'adult' | 'child';
    }> = [];

    // Primary guest (adult)
    guests.push({ firstName, lastName, type: 'adult' });

    // Partner (adult, if present)
    if (row['Partner First Name']) {
      guests.push({
        firstName: row['Partner First Name'],
        lastName: row['Partner Last Name'] || '',
        type: 'adult',
      });
    }

    // Children (if present)
    let hasChildren = false;

    for (let i = 1; i <= 5; i++) {
      const childFirstName = row[`Child ${i} First Name` as keyof CSVRow];
      const childLastName = row[`Child ${i} Last Name` as keyof CSVRow];

      if (childFirstName) {
        guests.push({
          firstName: childFirstName,
          lastName: childLastName || '',
          type: 'child',
        });
        hasChildren = true;
      }
    }

    // Generate invitation address based on guest composition
    const adults = guests.filter(
      (g) => g.type === 'adult' && g.firstName.toLowerCase() !== 'guest',
    );
    const mailingAddress = generateInvitationAddress(adults, hasChildren);

    // Create Invitation record
    const invitationValues = [
      invitationId,
      row['Relationship To Couple'] || null,
      totalInvited,
      row['Street Address'] || null,
      row['Street Address (line 2)'] || null,
      row['City'] || null,
      row['State / Region'] || null,
      row['Zip / Postal Code'] || null,
      row['Country'] || null,
      mailingAddress,
      '[0,1,2,3]',
      now,
      now,
    ];

    const invitationSqlValues = invitationValues
      .map((value) => {
        if (value === null) {
          return 'NULL';
        }

        if (typeof value === 'number') {
          return value.toString();
        }

        return `'${String(value).replace(/'/g, "''")}'`;
      })
      .join(', ');

    insertStatements.push(
      `INSERT INTO "Invitation" ("id", "relationshipToCouple", "totalInvited", "address", "addressLine2", "city", "state", "zipCode", "country", "mailingAddress", "visibleEvents", "createdAt", "updatedAt") VALUES (${invitationSqlValues});`,
    );
    invitationsCreated++;

    // Insert all guests for this invitation
    for (const guest of guests) {
      const guestValues = [
        randomUUID(),
        invitationId,
        null, // userId (will be set on first login)
        guest.firstName,
        guest.lastName,
        guest.type,
        now,
        now,
      ];

      const guestSqlValues = guestValues
        .map((value) => {
          if (value === null) {
            return 'NULL';
          }

          if (typeof value === 'number') {
            return value.toString();
          }

          return `'${String(value).replace(/'/g, "''")}'`;
        })
        .join(', ');

      insertStatements.push(
        `INSERT INTO "Guest" ("id", "invitationId", "userId", "firstName", "lastName", "type", "createdAt", "updatedAt") VALUES (${guestSqlValues});`,
      );
      guestsCreated++;
    }

    console.log(
      `✅ Invitation for ${firstName} ${lastName} (${guests.length} guests)`,
    );
  }

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
  const wranglerArgs = ['d1', 'execute', dbName, '--file', seedFilePath];

  if (isLocal) {
    wranglerArgs.push('--local');
  } else {
    wranglerArgs.push('--env', environment, '--remote');
  }

  execFileSync('wrangler', wranglerArgs, { stdio: 'inherit' });
}

// Run import
importGuests().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
