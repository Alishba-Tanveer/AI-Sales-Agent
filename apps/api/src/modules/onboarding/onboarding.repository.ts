import { prisma } from "@ai-sales-agent/database";
import type { OnboardingInput } from "./onboarding.schema";

export class OnboardingRepository {
  async getByOrganizationId(organizationId: string) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
    });
  }

  async updateOrganization(organizationId: string, data: OnboardingInput) {
    return prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(data.companyName ? { name: data.companyName } : {}),
        websiteUrl: data.websiteUrl,
        industry: data.industry,
        description: data.description,
        services: data.services,
        differentiation: data.differentiation,
        targetIndustries: data.targetIndustries,
        targetTitles: data.targetTitles,
        locations: data.locations,
        companySize: data.companySize,
        customerDescription: data.customerDescription,
        ...(data.complete === true ? { onboardingCompleted: true } : {}),
      },
    });
  }
}