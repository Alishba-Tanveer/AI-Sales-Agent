import { Router } from "express";
import { ApprovalsRepository } from "./approvals.repository";
import { ApprovalsService } from "./approvals.service";
import { ApprovalsController } from "./approvals.controller";
import { requireAuth } from "../../middleware/auth";

const approvalsRepository = new ApprovalsRepository();
const approvalsService = new ApprovalsService(approvalsRepository);
const approvalsController = new ApprovalsController(approvalsService);

const router = Router();

router.use(requireAuth);

router.get("/", approvalsController.list);
router.post("/", approvalsController.create);
router.post("/bulk-approve", approvalsController.bulkApprove);
router.get("/:id", approvalsController.getById);
router.post("/:id/approve", approvalsController.approve);
router.post("/:id/reject", approvalsController.reject);

export const approvalsRoutes = router;
