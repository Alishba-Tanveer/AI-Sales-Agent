import { Router } from "express";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { requireAuth } from "../../middleware/auth";

const analyticsService = new AnalyticsService();
const analyticsController = new AnalyticsController(analyticsService);

const router = Router();
router.use(requireAuth);

router.get("/overview", analyticsController.getOverview);
router.get("/nav-counts", analyticsController.getNavCounts);

export const analyticsRoutes = router;
