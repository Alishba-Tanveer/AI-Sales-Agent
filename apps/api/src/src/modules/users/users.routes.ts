import { Router } from "express";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { requireAuth } from "../../middleware/auth";

const usersRepository = new UsersRepository();
const usersService = new UsersService(usersRepository);
const usersController = new UsersController(usersService);

const router = Router();

router.get("/me", requireAuth, usersController.getMe);
router.patch("/me", requireAuth, usersController.updateMe);
router.post("/me/avatar", requireAuth, usersController.uploadAvatar);
router.delete("/me/avatar", requireAuth, usersController.removeAvatar);
router.delete("/me", requireAuth, usersController.deleteMe);

export const usersRoutes = router;
