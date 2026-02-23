#!/usr/bin/env tsx

/**
 * Generate SQL seed file from Zola CSV data and optionally import into D1.
 *
 * Usage:
 *   npm run db:seed
 *   npm run db:seed:d1 -- --env production
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

  // Read CSV file
  const csvPath = join(
    process.cwd(),
    'seed-data',
    'address-list-from-zola.csv',
  );
  const csvContent = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);

  console.log(`📋 Found ${rows.length} guest records in CSV\n`);

  let imported = 0;
  let skipped = 0;
  const insertStatements: string[] = [];

  for (const row of rows) {
    const firstName = row['First Name'];
    const lastName = row['Last Name'];

    if (!firstName || !lastName) {
      console.log(`⚠️  Skipping row with missing name`);
      skipped++;
      continue;
    }

    const totalInvited = parseInt(row['Total Definitely Invited']) || 1;
    const insertValues = [
      randomUUID(),
      null,
      firstName,
      lastName,
      row['Partner First Name'] || null,
      row['Partner Last Name'] || null,
      row['Relationship To Couple'] || null,
      totalInvited,
      row['Street Address'] || null,
      row['Street Address (line 2)'] || null,
      row['City'] || null,
      row['State / Region'] || null,
      row['Zip / Postal Code'] || null,
      row['Country'] || null,
      '[0,1,2,3]',
      now,
      now,
    ];

    const sqlValues = insertValues
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
      `INSERT INTO "Guest" ("id", "userId", "firstName", "lastName", "partnerFirstName", "partnerLastName", "relationshipToCouple", "totalInvited", "address", "addressLine2", "city", "state", "zipCode", "country", "visibleEvents", "createdAt", "updatedAt") VALUES (${sqlValues});`,
    );

    console.log(`✅ Staged: ${firstName} ${lastName}`);
    imported++;
  }

  const seedFilePath = join(process.cwd(), 'seed-data', 'guests-import.sql');
  const sqlFileContents = [
    'PRAGMA foreign_keys=OFF;',
    'BEGIN TRANSACTION;',
    ...insertStatements,
    'COMMIT;',
    'PRAGMA foreign_keys=ON;',
  ].join('\n');

  writeFileSync(seedFilePath, sqlFileContents, 'utf-8');

  console.log(`\n🎊 Seed file created at ${seedFilePath}`);
  console.log(`   Staged:   ${imported}`);
  console.log(`   Skipped:  ${skipped}`);
  console.log(`   Total:    ${rows.length}`);

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
