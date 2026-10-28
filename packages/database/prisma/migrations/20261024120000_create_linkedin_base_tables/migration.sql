-- Create the base LinkedIn tables.
-- OAuth-specific columns are added by the later
-- 20261027130000_linkedin_integrations migration.

CREATE TABLE "LinkedinConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileUrl" TEXT,
    "offer" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "groundingFacts" JSONB,
    "latestScore" INTEGER NOT NULL DEFAULT 0,
    "latestReadAt" TEXT,
    "suggestions" JSONB,
    "auditHistory" JSONB,
    "remindAt" TEXT NOT NULL DEFAULT '08:30',
    "avatar" TEXT NOT NULL DEFAULT '',
    "heygenConnected" BOOLEAN NOT NULL DEFAULT false,
    "contentSources" JSONB,
    "strategyAgreedOn" TEXT NOT NULL DEFAULT '',
    "strategyWho" TEXT NOT NULL DEFAULT '',
    "strategyPerDay" INTEGER NOT NULL DEFAULT 0,
    "strategyMessage" TEXT NOT NULL DEFAULT '',
    "strategyFollowUpDays" INTEGER NOT NULL DEFAULT 0,
    "accountConnected" BOOLEAN NOT NULL DEFAULT false,
    "accountName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinConfig_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LinkedinConfig_organizationId_fkey"
        FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LinkedinConfig_organizationId_key"
    ON "LinkedinConfig"("organizationId");


CREATE TABLE "LinkedinScript" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'needs_approval',
    "draftNo" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "points" TEXT[],
    "cta" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 40,
    "words" INTEGER NOT NULL DEFAULT 100,
    "scheduledFor" TEXT,
    "postedAt" TEXT,
    "postUrl" TEXT,
    "postDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinScript_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LinkedinScript_organizationId_fkey"
        FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX "LinkedinScript_organizationId_status_idx"
    ON "LinkedinScript"("organizationId", "status");


CREATE TABLE "LinkedinLead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'buyer',
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "reason" TEXT NOT NULL,
    "reasonKind" TEXT NOT NULL DEFAULT 'fit',
    "note" TEXT NOT NULL,
    "url" TEXT,
    "sentAt" TEXT,
    "connectedAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinLead_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LinkedinLead_organizationId_fkey"
        FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX "LinkedinLead_organizationId_status_idx"
    ON "LinkedinLead"("organizationId", "status");

CREATE INDEX "LinkedinLead_organizationId_source_idx"
    ON "LinkedinLead"("organizationId", "source");
