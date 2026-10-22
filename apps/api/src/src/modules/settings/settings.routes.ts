import { Router } from "express";
import { SettingsRepository } from "./settings.repository";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";
import { requireAuth } from "../../middleware/auth";

const settingsRepository = new SettingsRepository();
const settingsService = new SettingsService(settingsRepository);
const settingsController = new SettingsController(settingsService);

const router = Router();

router.use(requireAuth);

router.get("/outreach", settingsController.getOutreach);
router.put("/outreach", settingsController.saveOutreach);
router.post("/outreach/approve", settingsController.approveOutreach);

router.get("/approval-rules", settingsController.getApprovalRules);
router.put("/approval-rules", settingsController.saveApprovalRules);

router.get("/notifications", settingsController.getNotifications);
router.put("/notifications", settingsController.saveNotifications);

router.get("/usage", settingsController.getUsage);
router.put("/usage/ai-limit", settingsController.updateAiLimit);

router.get("/test-mode", settingsController.getTestMode);
router.put("/test-mode", settingsController.updateTestMode);

export const settingsRoutes = router;
