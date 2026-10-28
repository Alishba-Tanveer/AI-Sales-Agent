ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'DO_NOT_CONTACT';

CREATE TYPE "LeadMessageChannel" AS ENUM ('EMAIL', 'LINKEDIN');
CREATE TYPE "LeadMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "LeadMessageStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED');

ALTER TABLE "Lead"
  ADD COLUMN "linkedinUrl" TEXT,
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Lead_organizationId_archivedAt_idx" ON "Lead"("organizationId", "archivedAt");

ALTER TABLE "LinkedinLead" ADD COLUMN "crmLeadId" TEXT;
CREATE UNIQUE INDEX "LinkedinLead_crmLeadId_key" ON "LinkedinLead"("crmLeadId");
ALTER TABLE "LinkedinLead"
  ADD CONSTRAINT "LinkedinLead_crmLeadId_fkey"
  FOREIGN KEY ("crmLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LeadCommunication" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "channel" "LeadMessageChannel" NOT NULL,
  "direction" "LeadMessageDirection" NOT NULL,
  "status" "LeadMessageStatus" NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadCommunication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadCommunication_organizationId_occurredAt_idx" ON "LeadCommunication"("organizationId", "occurredAt");
CREATE INDEX "LeadCommunication_leadId_occurredAt_idx" ON "LeadCommunication"("leadId", "occurredAt");
CREATE INDEX "LeadCommunication_organizationId_status_occurredAt_idx" ON "LeadCommunication"("organizationId", "status", "occurredAt");
ALTER TABLE "LeadCommunication"
  ADD CONSTRAINT "LeadCommunication_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeadCommunication_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
