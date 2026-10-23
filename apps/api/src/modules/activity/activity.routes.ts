import { Router } from "express";
import { ActivityRepository } from "./activity.repository";
import { ActivityService } from "./activity.service";
import { ActivityController } from "./activity.controller";
import { requireAuth } from "../../middleware/auth";

const activityRepository = new ActivityRepository();
export const activityService = new ActivityService(activityRepository);
const activityController = new ActivityController(activityService);

const router = Router();

router.use(requireAuth);

router.get("/", activityController.listActivity);
router.get("/running-count", activityController.getRunningCount);
router.post("/jobs", activityController.createJob);
router.post("/:id/retry", activityController.retryJob);
router.post("/:id/cancel", activityController.cancelJob);

export const activityRoutes = router;
