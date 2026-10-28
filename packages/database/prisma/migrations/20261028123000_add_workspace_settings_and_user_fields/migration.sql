ALTER TABLE "User"
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "roleTitle" TEXT DEFAULT 'Chief Growth Officer & Co-Founder',
  ADD COLUMN "timezone" TEXT DEFAULT '(UTC-05:00) Eastern Time (US & Canada)',
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WorkspaceSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tone" TEXT NOT NULL DEFAULT 'professional',
  "maxFollowUps" INTEGER NOT NULL DEFAULT 3,
  "intervalDays" INTEGER NOT NULL DEFAULT 3,
  "dailyCap" INTEGER NOT NULL DEFAULT 40,
  "weeklyLinkedinLimit" INTEGER NOT NULL DEFAULT 100,
  "postingFrequency" TEXT NOT NULL DEFAULT '3x_week',
  "outreachApproved" BOOLEAN NOT NULL DEFAULT false,
  "outreachApprovedAt" TIMESTAMP(3),
  "approvalThreshold" INTEGER NOT NULL DEFAULT 92,
  "requireApprovalNewEmails" BOOLEAN NOT NULL DEFAULT true,
  "requireApprovalVideoScripts" BOOLEAN NOT NULL DEFAULT true,
  "requireApprovalReplies" BOOLEAN NOT NULL DEFAULT true,
  "requireApprovalFollowups" BOOLEAN NOT NULL DEFAULT false,
  "requireApprovalLinkedin" BOOLEAN NOT NULL DEFAULT true,
  "notificationRules" JSONB,
  "sentToday" INTEGER NOT NULL DEFAULT 14,
  "aiSpendThisMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "aiLimit" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "requestsToday" INTEGER NOT NULL DEFAULT 38,
  "requestsDailyLimit" INTEGER NOT NULL DEFAULT 250,
  "testMode" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceSettings_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkspaceSettings_organizationId_key"
  ON "WorkspaceSettings"("organizationId");
