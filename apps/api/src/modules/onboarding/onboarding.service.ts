import { OnboardingRepository } from "./onboarding.repository";
import type { OnboardingInput } from "./onboarding.schema";
import { AppError } from "../../utils/app-error";

export class OnboardingService {
  constructor(private readonly onboardingRepository: OnboardingRepository) {}

  async getOnboarding(organizationId: string) {
    const org = await this.onboardingRepository.getByOrganizationId(organizationId);
    if (!org) {
      throw new AppError("Organization not found", 404);
    }
    return org;
  }

  async saveOnboarding(organizationId: string, input: OnboardingInput) {
    return this.onboardingRepository.updateOrganization(organizationId, input);
  }
}