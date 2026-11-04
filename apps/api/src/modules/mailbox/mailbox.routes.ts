import { Router } from "express";
import { Role } from "@ai-sales-agent/database";
import { requireAuth, requireRole } from "../../middleware/auth";
import { mailboxController } from "./mailbox.controller";

const router = Router();
router.use(requireAuth);

const ownerOrAdmin = requireRole(Role.OWNER, Role.ADMIN);

// Anyone in the workspace can see whether the mailbox is connected, sync replies and approve a draft for sending.
router.get("/", mailboxController.status);
router.post("/sync", mailboxController.sync);
router.post("/drafts/:id/send", mailboxController.sendDraft);

// Connecting or changing the mailbox is limited to the Owner and Admins (same rule as every other integration).
router.post("/connect", ownerOrAdmin, mailboxController.connect);
router.patch("/settings", ownerOrAdmin, mailboxController.settings);
router.delete("/", ownerOrAdmin, mailboxController.disconnect);

export const mailboxRoutes = router;
