#!/usr/bin/env tsx

/**
 * Import guests from Zola CSV file into the database.
 *
 * Usage:
 *   npm run db:seed          # Import to local SQLite
 *   npm run db:seed:remote   # Import to remote D1 (requires wrangler)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { getPrismaClient } from '@/lib/db';

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
  const isRemote = process.argv.includes('--remote');

  console.log(
    `🎉 Importing guests to ${isRemote ? 'remote D1' : 'local SQLite'}...\n`,
  );

  // Read CSV file
  const csvPath = join(
    process.cwd(),
    'seed-data',
    'address-list-from-zola.csv',
  );
  const csvContent = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);

  console.log(`📋 Found ${rows.length} guest records in CSV\n`);

  const prisma = await getPrismaClient();

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const firstName = row['First Name'];
    const lastName = row['Last Name'];

    if (!firstName || !lastName) {
      console.log(`⚠️  Skipping row with missing name`);
      skipped++;
      continue;
    }

    try {
      // Check if guest already exists
      const existing = await prisma.guest.findFirst({
        where: {
          firstName,
          lastName,
        },
      });

      if (existing) {
        console.log(`⏭️  Guest already exists: ${firstName} ${lastName}`);
        skipped++;
        continue;
      }

      const totalInvited = parseInt(row['Total Definitely Invited']) || 1;

      await prisma.guest.create({
        data: {
          firstName,
          lastName,
          partnerFirstName: row['Partner First Name'] || null,
          partnerLastName: row['Partner Last Name'] || null,
          relationshipToCouple: row['Relationship To Couple'] || null,
          totalInvited,
          address: row['Street Address'] || null,
          addressLine2: row['Street Address (line 2)'] || null,
          city: row['City'] || null,
          state: row['State / Region'] || null,
          zipCode: row['Zip / Postal Code'] || null,
          country: row['Country'] || null,
          visibleEvents: '[0,1,2,3]', // All events visible by default
        },
      });

      console.log(`✅ Imported: ${firstName} ${lastName}`);
      imported++;
    } catch (error) {
      console.error(`❌ Error importing ${firstName} ${lastName}:`, error);
      skipped++;
    }
  }

  console.log(`\n🎊 Import complete!`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Skipped:  ${skipped}`);
  console.log(`   Total:    ${rows.length}`);

  await prisma.$disconnect();
}

// Run import
importGuests().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
