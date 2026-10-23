import { Router } from "express";
import { TeamRepository } from "./team.repository";
import { TeamService } from "./team.service";
import { TeamController } from "./team.controller";
import { requireAuth } from "../../middleware/auth";

const teamRepository = new TeamRepository();
const teamService = new TeamService(teamRepository);
const teamController = new TeamController(teamService);

const router = Router();

/* Members. Every signed-in role can read the list; the service restricts everything else to Owner/Admin. */
router.get("/members", requireAuth, teamController.listMembers);
// Must stay ABOVE any "/members/:id" route so "removed" is not read as an id.
router.get("/members/removed", requireAuth, teamController.listRemovedMembers);
router.post("/members/:id/restore", requireAuth, teamController.restoreMember);
router.post("/members/:id/transfer-ownership", requireAuth, teamController.transferOwnership);
router.post("/transfer-ownership", requireAuth, teamController.transferOwnership);
router.patch("/members/:id", requireAuth, teamController.updateMemberRole);
router.delete("/members/:id", requireAuth, teamController.removeMember);

/* Invitations */
router.post("/invitations", requireAuth, teamController.createInvitation);
// Public: the person opening the emailed link is not signed in yet.
router.post("/invitations/accept", teamController.acceptInvitation);
router.get("/invitations/accept", teamController.lookupInvitation); // ?token=...
router.get("/invitations/:token", teamController.lookupInvitation);
router.post("/invitations/:id/resend", requireAuth, teamController.resendInvitation);
router.delete("/invitations/:id", requireAuth, teamController.revokeInvitation);

export const teamRoutes = router;
