import { Router } from "express";
import { Role } from "@ai-sales-agent/database";
import { SettingsRepository } from "./settings.repository";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";
import { requireAuth, requireRole } from "../../middleware/auth";

const settingsRepository = new SettingsRepository();
const settingsService = new SettingsService(settingsRepository);
const settingsController = new SettingsController(settingsService);

const router = Router();

router.use(requireAuth);

/**
 * Who may use which setting (enforced here, not just hidden in the UI):
 *   Member   Notifications
 *   Admin    everything a Member can, plus Outreach Strategy and Approval Rules
 *   Owner    everything an Admin can, plus Usage and Limits (AI spend limit)
 */
const ownerOrAdmin = requireRole(Role.OWNER, Role.ADMIN);
const ownerOnly = requireRole(Role.OWNER);

router.get("/outreach", ownerOrAdmin, settingsController.getOutreach);
router.put("/outreach", ownerOrAdmin, settingsController.saveOutreach);
router.post("/outreach/approve", ownerOrAdmin, settingsController.approveOutreach);

router.get("/approval-rules", ownerOrAdmin, settingsController.getApprovalRules);
router.put("/approval-rules", ownerOrAdmin, settingsController.saveApprovalRules);

router.get("/notifications", settingsController.getNotifications);
router.put("/notifications", settingsController.saveNotifications);

router.get("/usage", ownerOnly, settingsController.getUsage);
router.put("/usage/ai-limit", ownerOnly, settingsController.updateAiLimit);

export const settingsRoutes = router;
