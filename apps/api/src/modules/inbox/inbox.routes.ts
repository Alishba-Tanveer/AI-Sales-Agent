import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { inboxController } from "./inbox.controller";

const router = Router();
router.use(requireAuth);
router.get("/", inboxController.list);
router.post("/", inboxController.recordInbound);
router.get("/:id", inboxController.get);
router.delete("/:id", requireRole("OWNER"), inboxController.deleteThread);
router.post("/:id/draft-reply", inboxController.draftReply);
router.post("/drafts/:id/mark-sent", inboxController.markSent);

export const inboxRoutes = router;
