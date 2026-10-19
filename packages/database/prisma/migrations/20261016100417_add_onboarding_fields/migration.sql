-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "companySize" TEXT,
ADD COLUMN     "customerDescription" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "differentiation" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "websiteUrl" TEXT;
