ALTER TABLE "Lead" ALTER COLUMN "stage" DROP DEFAULT;

UPDATE "Lead" SET "stage" = 'NEW' WHERE "stage" = 'REVIEWED';

ALTER TYPE "LeadStage" RENAME TO "LeadStage_old";
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'WON', 'LOST', 'DO_NOT_CONTACT');

ALTER TABLE "Lead"
  ALTER COLUMN "stage" TYPE "LeadStage" USING ("stage"::text::"LeadStage"),
  ALTER COLUMN "stage" SET DEFAULT 'NEW';

DROP TYPE "LeadStage_old";
