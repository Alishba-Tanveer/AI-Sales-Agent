import { Router } from "express";
import { OnboardingRepository } from "./onboarding.repository";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";
import { requireAuth } from "../../middleware/auth";

const repository = new OnboardingRepository();
const service = new OnboardingService(repository);
const controller = new OnboardingController(service);

const router = Router();

// Protect all onboarding routes with requireAuth
router.use(requireAuth);

router.get("/", controller.get);
router.post("/", controller.save);

export const onboardingRoutes = router;