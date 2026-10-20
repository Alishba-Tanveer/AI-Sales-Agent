import { Router } from "express";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { requireAuth } from "../../middleware/auth";

const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);
const authController = new AuthController(authService);

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-otp", authController.verifyOtp);
router.post("/reset-password", authController.resetPassword);
router.post("/change-password", requireAuth, authController.changePassword);
router.post("/logout-others", requireAuth, authController.logoutOthers);
router.post("/logout", requireAuth, authController.logout);

export const authRoutes = router;