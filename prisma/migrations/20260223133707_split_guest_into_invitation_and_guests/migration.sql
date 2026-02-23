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

-- CreateIndex
CREATE INDEX "Guest_firstName_lastName_idx" ON "Guest"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "Guest_invitationId_idx" ON "Guest"("invitationId");
