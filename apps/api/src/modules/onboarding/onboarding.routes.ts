import { Router } from "express";
import { OnboardingRepository } from "./onboarding.repository";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";
import { Role } from "@ai-sales-agent/database";
import { requireAuth, requireRole } from "../../middleware/auth";

const repository = new OnboardingRepository();
const service = new OnboardingService(repository);
const controller = new OnboardingController(service);

const router = Router();

// Protect all onboarding routes with requireAuth
router.use(requireAuth);

// Everybody can read the company profile (the dashboard checks whether setup is complete);
// only an Owner or Admin can change the business details.
router.get("/", controller.get);
router.post("/", requireRole(Role.OWNER, Role.ADMIN), controller.save);

export const onboardingRoutes = router;