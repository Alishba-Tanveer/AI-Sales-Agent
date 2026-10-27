import { Router } from "express";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { requireAuth } from "../../middleware/auth";

const notificationsRepository = new NotificationsRepository();
export const notificationsService = new NotificationsService(notificationsRepository);
const notificationsController = new NotificationsController(notificationsService);

const router = Router();

router.use(requireAuth);

router.get("/", notificationsController.listNotifications);
router.get("/unread-count", notificationsController.getUnreadCount);
// No public "create" route: only the server creates notifications (utils/notify.ts), so nobody can forge one.
router.patch("/:id", notificationsController.updateNotification);
router.patch("/:id/read", notificationsController.updateNotification);
router.post("/read-all", notificationsController.markAllRead);
router.post("/mark-all-read", notificationsController.markAllRead);
router.delete("/:id", notificationsController.dismissNotification);
router.delete("/", notificationsController.clearAll);

export const notificationsRoutes = router;
