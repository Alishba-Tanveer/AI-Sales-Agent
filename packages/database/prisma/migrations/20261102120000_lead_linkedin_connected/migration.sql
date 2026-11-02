-- Track whether a lead accepted your LinkedIn connection request (replaces the hidden "Connected on LinkedIn" timeline entry).
ALTER TABLE "Lead" ADD COLUMN "linkedinConnectedAt" TIMESTAMP(3);

-- Carry over leads already marked as connected through the old timeline entry.
UPDATE "Lead" AS l
SET "linkedinConnectedAt" = c."occurredAt"
FROM "LeadCommunication" AS c
WHERE c."leadId" = l."id"
  AND c."channel" = 'LINKEDIN'
  AND c."direction" = 'OUTBOUND'
  AND c."status" = 'SENT'
  AND c."subject" = 'Connected on LinkedIn';

-- Remove the old marker entries so they no longer show in conversations.
DELETE FROM "LeadCommunication"
WHERE "channel" = 'LINKEDIN'
  AND "direction" = 'OUTBOUND'
  AND "status" = 'SENT'
  AND "subject" = 'Connected on LinkedIn';
