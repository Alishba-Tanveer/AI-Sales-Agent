import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { leadsController } from "./leads.controller";

const router = Router();
router.use(requireAuth);
router.get("/", leadsController.list);
router.post("/", leadsController.create);
router.post("/import", leadsController.import);
router.get("/:id", leadsController.get);
router.patch("/:id", leadsController.update);
router.delete("/:id", requireRole("OWNER"), leadsController.archive);
router.post("/:id/find-contact", leadsController.findContact);
router.post("/:id/draft-email", leadsController.draftEmail);
router.post("/:id/linkedin-connected", leadsController.markLinkedInConnected);

export const leadsRoutes = router;
