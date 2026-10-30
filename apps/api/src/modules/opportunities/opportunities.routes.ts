import { Router } from "express";
import { OpportunitiesRepository } from "./opportunities.repository";
import { OpportunitiesService } from "./opportunities.service";
import { OpportunitiesController } from "./opportunities.controller";
import { requireAuth } from "../../middleware/auth";

const opportunitiesRepository = new OpportunitiesRepository();
export const opportunitiesService = new OpportunitiesService(opportunitiesRepository);
const opportunitiesController = new OpportunitiesController(opportunitiesService);

const router = Router();
router.use(requireAuth);

router.post("/search", opportunitiesController.search);
router.post("/:id/saved", opportunitiesController.saveAsLead);
router.post("/:id/dismiss", opportunitiesController.dismiss);
router.post("/:id/restore", opportunitiesController.restore);
router.get("/", opportunitiesController.list);

export const opportunitiesRoutes = router;
