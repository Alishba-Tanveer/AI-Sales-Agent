-- Add lifecycle fields for team invitations.
ALTER TABLE "TeamInvitation"
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "emailError" TEXT,
  ADD COLUMN "lastSentAt" TIMESTAMP(3),
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Add account-removal audit fields.
ALTER TABLE "User"
  ADD COLUMN "removedById" TEXT,
  ADD COLUMN "removedReason" TEXT;
