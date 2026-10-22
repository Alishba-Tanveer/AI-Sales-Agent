import { Router } from "express";
import { TeamRepository } from "./team.repository";
import { TeamService } from "./team.service";
import { TeamController } from "./team.controller";
import { requireAuth } from "../../middleware/auth";

const teamRepository = new TeamRepository();
const teamService = new TeamService(teamRepository);
const teamController = new TeamController(teamService);

const router = Router();

router.get("/members", requireAuth, teamController.listMembers);
router.post("/invitations", requireAuth, teamController.createInvitation);
router.post("/invitations/accept", teamController.acceptInvitation);
router.post("/invitations/:id/resend", requireAuth, teamController.resendInvitation);
router.delete("/invitations/:id", requireAuth, teamController.revokeInvitation);
router.patch("/members/:id", requireAuth, teamController.updateMemberRole);
router.delete("/members/:id", requireAuth, teamController.removeMember);

export const teamRoutes = router;
