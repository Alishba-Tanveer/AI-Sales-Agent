import { Router } from "express";
import { ActivityRepository } from "./activity.repository";
import { ActivityService } from "./activity.service";
import { ActivityController } from "./activity.controller";
import { requireAuth } from "../../middleware/auth";

const activityRepository = new ActivityRepository();
const activityService = new ActivityService(activityRepository);
const activityController = new ActivityController(activityService);

const activityRouter = Router();
activityRouter.use(requireAuth);
activityRouter.get("/", activityController.listActivity);
activityRouter.post("/jobs/test", activityController.runTestJob);
activityRouter.post("/jobs/purge", activityController.runPurgeJob);
activityRouter.post("/:id/retry", activityController.retryJob);

const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get("/", activityController.listNotifications);
notificationsRouter.post("/read-all", activityController.markAllNotificationsRead);
notificationsRouter.patch("/:id/read", activityController.markNotificationRead);

export const activityRoutes = activityRouter;
export const notificationsRoutes = notificationsRouter;
