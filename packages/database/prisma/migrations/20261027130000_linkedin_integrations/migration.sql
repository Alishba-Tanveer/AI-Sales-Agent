ALTER TABLE "LinkedinConfig" ALTER COLUMN "offer" SET DEFAULT '', ALTER COLUMN "latestScore" SET DEFAULT 0, ALTER COLUMN "avatar" SET DEFAULT '', ALTER COLUMN "heygenConnected" SET DEFAULT false, ALTER COLUMN "strategyAgreedOn" SET DEFAULT '', ALTER COLUMN "strategyWho" SET DEFAULT '', ALTER COLUMN "strategyMessage" SET DEFAULT '', ALTER COLUMN "strategyPerDay" SET DEFAULT 0, ALTER COLUMN "strategyFollowUpDays" SET DEFAULT 0, ALTER COLUMN "accountConnected" SET DEFAULT false;
UPDATE "LinkedinConfig" SET "offer"=CASE WHEN "offer"='I build AI agents for B2B SaaS outbound' THEN '' ELSE "offer" END, "latestScore"=CASE WHEN "latestScore"=84 AND "latestReadAt" IS NULL THEN 0 ELSE "latestScore" END, "avatar"=CASE WHEN "avatar"='Ahmed Avatar v2' THEN '' ELSE "avatar" END, "heygenConnected"=CASE WHEN "avatar"='Ahmed Avatar v2' THEN false ELSE "heygenConnected" END, "strategyPerDay"=CASE WHEN "strategyAgreedOn"='2026-10-10' OR "strategyWho"='VPs and Heads of Sales at B2B SaaS companies, 50-500 employees, US and UK' THEN 0 ELSE "strategyPerDay" END, "strategyFollowUpDays"=CASE WHEN "strategyAgreedOn"='2026-10-10' OR "strategyWho"='VPs and Heads of Sales at B2B SaaS companies, 50-500 employees, US and UK' THEN 0 ELSE "strategyFollowUpDays" END, "strategyAgreedOn"=CASE WHEN "strategyAgreedOn"='2026-10-10' THEN '' ELSE "strategyAgreedOn" END, "strategyWho"=CASE WHEN "strategyWho"='VPs and Heads of Sales at B2B SaaS companies, 50-500 employees, US and UK' THEN '' ELSE "strategyWho" END, "strategyMessage"=CASE WHEN "strategyMessage" LIKE 'Hi {first_name}, I saw your post on {topic}. I work with SaaS sales teams%' THEN '' ELSE "strategyMessage" END, "accountConnected"=false WHERE "accountConnected"=true OR "offer"='I build AI agents for B2B SaaS outbound' OR "avatar"='Ahmed Avatar v2' OR "strategyAgreedOn"='2026-10-10';
ALTER TABLE "LinkedinConfig" ADD COLUMN "linkedinMemberUrn" TEXT, ADD COLUMN "linkedinAccessToken" TEXT, ADD COLUMN "linkedinRefreshToken" TEXT, ADD COLUMN "linkedinTokenExpiresAt" TIMESTAMP(3), ADD COLUMN "linkedinScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "oauthStateHash" TEXT, ADD COLUMN "oauthStateExpiresAt" TIMESTAMP(3), ADD COLUMN "oauthStateUserId" TEXT;
CREATE UNIQUE INDEX "LinkedinConfig_oauthStateHash_key" ON "LinkedinConfig"("oauthStateHash");

DELETE FROM "LinkedinScript" WHERE "title" IN (
  'Meta wants to pay for its broad AI buildout with a newly created class of stock',
  'B2B buyers want fewer, better messages'
);
DELETE FROM "LinkedinLead" WHERE ("name","company") IN (
  ('Liam O''Connor','ScaleOps AI'), ('Sophia Martinez','DataPulse'),
  ('Priya Nair','Cloudwise'), ('Aisha Khan','Stackly'), ('Marcus Webb','Pipeline.io'),
  ('Elena Rossi','Brightly'), ('Jonas Meyer','Lumen'), ('Alex Rivera','StackGrowth'),
  ('Nora Fields','Vantage'), ('Ben Carter','Orbit'), ('Maya Singh','Helio'), ('Chris Dunn','Atlas')
);

UPDATE "LinkedinConfig" SET "contentSources"='[]'::jsonb WHERE "contentSources"='[{"name":"TechCrunch","url":"https://techcrunch.com","enabled":true},{"name":"Reuters","url":"https://reuters.com","enabled":true},{"name":"Forbes","url":"https://forbes.com","enabled":true}]'::jsonb;
