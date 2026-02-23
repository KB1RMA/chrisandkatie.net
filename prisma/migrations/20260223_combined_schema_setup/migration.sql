-- Combined migration: Auth, Guest/Invitation structure, RSVP fields, and mailing address

-- ============================================================================
-- PHASE 1: Create Auth tables and initial Guest table
-- ============================================================================

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: Account
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: Session
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: VerificationToken
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable: Guest (initial schema)
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "partnerFirstName" TEXT,
    "partnerLastName" TEXT,
    "relationshipToCouple" TEXT,
    "totalInvited" INTEGER NOT NULL DEFAULT 1,
    "address" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "visibleEvents" TEXT NOT NULL DEFAULT '[0,1,2,3]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex for User
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex for Account
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex for Session
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex for VerificationToken
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex for VerificationToken identifier/token combo
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex for Guest
CREATE UNIQUE INDEX "Guest_userId_key" ON "Guest"("userId");
CREATE INDEX "Guest_firstName_lastName_idx" ON "Guest"("firstName", "lastName");

-- ============================================================================
-- PHASE 2: Split Guest into Invitation and new Guest structure
-- ============================================================================

-- CreateTable: Invitation
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relationshipToCouple" TEXT,
    "totalInvited" INTEGER NOT NULL DEFAULT 1,
    "address" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "visibleEvents" TEXT NOT NULL DEFAULT '[0,1,2,3]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable: New Guest table with invitationId
CREATE TABLE "Guest_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'adult',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guest_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Guest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Migrate data from old Guest table to Invitation
INSERT INTO "Invitation" (
    "id",
    "relationshipToCouple",
    "totalInvited",
    "address",
    "addressLine2",
    "city",
    "state",
    "zipCode",
    "country",
    "visibleEvents",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "relationshipToCouple",
    "totalInvited",
    "address",
    "addressLine2",
    "city",
    "state",
    "zipCode",
    "country",
    "visibleEvents",
    "createdAt",
    "updatedAt"
FROM "Guest";

-- Migrate primary guest (firstName, lastName) from old Guest table
INSERT INTO "Guest_new" (
    "id",
    "invitationId",
    "userId",
    "firstName",
    "lastName",
    "type",
    "createdAt",
    "updatedAt"
)
SELECT
    substr(hex(randomblob(16)), 1, 32),
    "id",
    "userId",
    "firstName",
    "lastName",
    'adult',
    "createdAt",
    "updatedAt"
FROM "Guest";

-- Migrate partner guests (partnerFirstName, partnerLastName) from old Guest table
INSERT INTO "Guest_new" (
    "id",
    "invitationId",
    "userId",
    "firstName",
    "lastName",
    "type",
    "createdAt",
    "updatedAt"
)
SELECT
    substr(hex(randomblob(16)), 1, 32),
    "id",
    NULL,
    "partnerFirstName",
    "partnerLastName",
    'adult',
    "createdAt",
    "updatedAt"
FROM "Guest"
WHERE "partnerFirstName" IS NOT NULL AND "partnerFirstName" != '';

-- Drop old Guest table
DROP TABLE "Guest";

-- Rename Guest_new to Guest
ALTER TABLE "Guest_new" RENAME TO "Guest";

-- CreateIndex
CREATE UNIQUE INDEX "Guest_userId_key" ON "Guest"("userId");
CREATE INDEX "Guest_firstName_lastName_idx" ON "Guest"("firstName", "lastName");
CREATE INDEX "Guest_invitationId_idx" ON "Guest"("invitationId");

-- ============================================================================
-- PHASE 3: Add RSVP fields to Guest table
-- ============================================================================

-- AddColumn: attending to Guest table
ALTER TABLE "Guest" ADD COLUMN "attending" INTEGER;

-- AddColumn: dietaryRestrictions to Guest table
ALTER TABLE "Guest" ADD COLUMN "dietaryRestrictions" TEXT;

-- AddColumn: notes to Guest table
ALTER TABLE "Guest" ADD COLUMN "notes" TEXT;

-- ============================================================================
-- PHASE 4: Rename dietary to meal choice
-- ============================================================================

-- Rename dietaryRestrictions column to mealChoice
ALTER TABLE "Guest" RENAME COLUMN "dietaryRestrictions" TO "mealChoice";

-- ============================================================================
-- PHASE 5: Add mailing address field to Invitation
-- ============================================================================

-- Add mailing address field to Invitation
-- Stores the return address that was on the invitation envelope
ALTER TABLE "Invitation" ADD COLUMN "mailingAddress" TEXT;
