import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { leadsController } from "./leads.controller";

const router = Router();
router.use(requireAuth);
router.get("/", leadsController.list);
router.post("/", leadsController.create);
router.post("/import", leadsController.import);
router.get("/:id", leadsController.get);
router.patch("/:id", leadsController.update);
router.delete("/:id", leadsController.archive);
router.post("/:id/draft-email", leadsController.draftEmail);

export const leadsRoutes = router;
