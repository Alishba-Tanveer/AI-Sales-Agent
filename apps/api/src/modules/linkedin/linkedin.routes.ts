import { Router } from "express";
import { Role } from "@ai-sales-agent/database";
import { requireAuth, requireRole } from "../../middleware/auth";
import { linkedinController } from "./linkedin.controller";

const router = Router();
router.get("/account/callback", (req, res) => linkedinController.linkedinOAuthCallback(req, res));
router.use(requireAuth);
const ownerOrAdmin = requireRole(Role.OWNER, Role.ADMIN);

/* ========================================================================
 * 1. PROFILE OPTIMIZER (/api/linkedin/profile/...)
 * ======================================================================== */

// Frontend api.ts + Excel spec (#28-#35)
router.get("/profile", (req, res, next) => linkedinController.getProfileAudit(req, res, next));
router.get("/profile/analyze", (req, res, next) => linkedinController.getProfileAudit(req, res, next));
router.post("/profile/import-pdf", (req, res, next) => linkedinController.importProfilePdf(req, res, next));
router.post("/profile/analyze", ownerOrAdmin, (req, res, next) => linkedinController.analyzeProfile(req, res, next));

router.get("/profile/audit", (req, res, next) => linkedinController.getProfileAudit(req, res, next));
router.post("/profile/audit", ownerOrAdmin, (req, res, next) => linkedinController.analyzeProfile(req, res, next));
router.post("/profile/recommendations/generate", ownerOrAdmin, (req, res, next) =>
  linkedinController.analyzeProfile(req, res, next),
);
router.post("/profile/recommendations/mark-applied", ownerOrAdmin, (req, res, next) =>
  linkedinController.markApplied(req, res, next),
);
router.post("/profile/suggestions/mark-done", ownerOrAdmin, (req, res, next) =>
  linkedinController.markApplied(req, res, next),
);
router.patch("/profile/recommendations/:id", ownerOrAdmin, (req, res, next) =>
  linkedinController.updateRecommendation(req, res, next),
);
router.patch("/profile/suggestions/:key", ownerOrAdmin, (req, res, next) =>
  linkedinController.updateRecommendation(req, res, next),
);
router.get("/profile/grounding-facts", (req, res, next) =>
  linkedinController.getGroundingFacts(req, res, next),
);
router.patch("/profile/grounding-facts/:key", ownerOrAdmin, (req, res, next) =>
  linkedinController.updateGroundingFact(req, res, next),
);
router.get("/profile/history", (req, res, next) =>
  linkedinController.getProfileHistory(req, res, next),
);

/* ========================================================================
 * 2. CONTENT ENGINE & VIDEO SCRIPTS (/api/linkedin/content/..., /posts/..., /video-scripts/...)
 * ======================================================================== */

// Post check (Frontend api.ts: POST /api/linkedin/posts/check)
router.post("/posts/check", (req, res, next) => linkedinController.checkPostStatus(req, res, next));

// Content settings (posting reminder)
router.get("/content/settings", (req, res, next) =>
  linkedinController.getContentSettings(req, res, next),
);
router.patch("/content/settings", ownerOrAdmin, (req, res, next) =>
  linkedinController.updateContentSettings(req, res, next),
);
router.put("/content/settings", ownerOrAdmin, (req, res, next) =>
  linkedinController.updateContentSettings(req, res, next),
);

// Content sources (#44-#45)
router.get("/content/sources", (req, res, next) =>
  linkedinController.getContentSources(req, res, next),
);
router.put("/content/sources", ownerOrAdmin, (req, res, next) =>
  linkedinController.updateContentSources(req, res, next),
);

// Bulk approve (#42)
router.post("/content/bulk-approve", (req, res, next) =>
  linkedinController.bulkApproveScripts(req, res, next),
);
router.post("/content/scripts/bulk-approve", (req, res, next) =>
  linkedinController.bulkApproveScripts(req, res, next),
);

// Scripts routes (Frontend api.ts: GET /api/linkedin/content/scripts + actions)
router.get("/content/scripts", (req, res, next) => linkedinController.listScripts(req, res, next));
router.post("/content/news/refresh", (req, res, next) => linkedinController.refreshNews(req, res, next));
router.post("/content/scripts", (req, res, next) => linkedinController.createScript(req, res, next));
router.get("/content/scripts/:id", (req, res, next) =>
  linkedinController.getScriptById(req, res, next),
);
router.patch("/content/scripts/:id", (req, res, next) =>
  linkedinController.updateScript(req, res, next),
);
router.delete("/content/scripts/:id", (req, res, next) =>
  linkedinController.deleteScript(req, res, next),
);
router.post("/content/scripts/:id/approve", (req, res, next) =>
  linkedinController.approveScript(req, res, next),
);
router.post("/content/scripts/:id/regenerate", (req, res, next) =>
  linkedinController.regenerateScript(req, res, next),
);
router.post("/content/scripts/:id/dismiss", (req, res, next) =>
  linkedinController.deleteScript(req, res, next),
);
router.post("/content/scripts/:id/cancel", (req, res, next) =>
  linkedinController.deleteScript(req, res, next),
);
router.post("/content/scripts/:id/mark-posted", (req, res, next) =>
  linkedinController.markScriptPosted(req, res, next),
);
router.post("/content/scripts/:id/mark-published", (req, res, next) =>
  linkedinController.markScriptPosted(req, res, next),
);

// Excel spec /api/linkedin/content aliases (#36-#43)
router.get("/content", (req, res, next) => linkedinController.listScripts(req, res, next));
router.post("/content", (req, res, next) => linkedinController.createScript(req, res, next));
router.get("/content/:id", (req, res, next) => linkedinController.getScriptById(req, res, next));
router.patch("/content/:id", (req, res, next) => linkedinController.updateScript(req, res, next));
router.delete("/content/:id", (req, res, next) => linkedinController.deleteScript(req, res, next));
router.post("/content/:id/approve", (req, res, next) =>
  linkedinController.approveScript(req, res, next),
);
router.post("/content/:id/regenerate", (req, res, next) =>
  linkedinController.regenerateScript(req, res, next),
);
router.post("/content/:id/dismiss", (req, res, next) =>
  linkedinController.deleteScript(req, res, next),
);
router.post("/content/:id/mark-published", (req, res, next) =>
  linkedinController.markScriptPosted(req, res, next),
);
router.post("/content/:id/mark-posted", (req, res, next) =>
  linkedinController.markScriptPosted(req, res, next),
);

// Excel spec /api/linkedin/video-scripts aliases (#46-#51)
router.get("/video-scripts", (req, res, next) => linkedinController.listScripts(req, res, next));
router.get("/video-scripts/:id", (req, res, next) =>
  linkedinController.getScriptById(req, res, next),
);
router.patch("/video-scripts/:id", (req, res, next) =>
  linkedinController.updateScript(req, res, next),
);
router.get("/video-scripts/:id/download", (req, res, next) =>
  linkedinController.downloadVideoScript(req, res, next),
);

/* ========================================================================
 * 3. ENGAGEMENT & CONNECTIONS + STRATEGY (/api/linkedin/strategy, /leads, /connections)
 * ======================================================================== */

// Outreach Strategy (Frontend api.ts: GET /api/linkedin/strategy + StrategyDialog)
router.get("/strategy", (req, res, next) => linkedinController.getStrategy(req, res, next));
router.put("/strategy", ownerOrAdmin, (req, res, next) => linkedinController.updateStrategy(req, res, next));
router.patch("/strategy", ownerOrAdmin, (req, res, next) => linkedinController.updateStrategy(req, res, next));

// Static /leads/* and /connections/* actions BEFORE /:id
router.post("/leads/bulk-approve", (req, res, next) =>
  linkedinController.bulkApproveLeads(req, res, next),
);
router.post("/connections/bulk-approve", (req, res, next) =>
  linkedinController.bulkApproveLeads(req, res, next),
);
router.post("/connections/discover", (req, res, next) =>
  linkedinController.discoverConnections(req, res, next),
);
router.post("/leads/discover", (req, res, next) =>
  linkedinController.discoverConnections(req, res, next),
);
router.post("/connections/import", (req, res, next) =>
  linkedinController.importLeads(req, res, next),
);
router.post("/leads/import", (req, res, next) => linkedinController.importLeads(req, res, next));

// Frontend /api/linkedin/leads routes
router.get("/leads", (req, res, next) => linkedinController.listLeads(req, res, next));
router.post("/leads", (req, res, next) => linkedinController.createLead(req, res, next));
router.get("/leads/:id", (req, res, next) => linkedinController.getLeadById(req, res, next));
router.patch("/leads/:id", (req, res, next) => linkedinController.updateLead(req, res, next));
router.patch("/leads/:id/note", (req, res, next) =>
  linkedinController.updateLeadNote(req, res, next),
);
router.post("/leads/:id/mark-sent", (req, res, next) => linkedinController.markLeadSent(req, res, next));
router.post("/leads/:id/send", (req, res, next) =>
  linkedinController.sendConnectionRequest(req, res, next),
);
router.post("/leads/:id/approve", (req, res, next) =>
  linkedinController.sendConnectionRequest(req, res, next),
);
router.post("/leads/:id/skip", (req, res, next) =>
  linkedinController.skipOrWithdrawLead(req, res, next),
);
router.post("/leads/:id/withdraw", (req, res, next) =>
  linkedinController.skipOrWithdrawLead(req, res, next),
);
router.post("/leads/:id/restore", (req, res, next) =>
  linkedinController.restoreLead(req, res, next),
);
router.post("/leads/:id/mark-connected", (req, res, next) =>
  linkedinController.markLeadConnected(req, res, next),
);
router.post("/leads/:id/add-to-leads", (req, res, next) =>
  linkedinController.addLeadToCrm(req, res, next),
);

// Excel spec /api/linkedin/connections routes (#53-#63)
router.get("/connections", (req, res, next) => linkedinController.listLeads(req, res, next));
router.post("/connections", (req, res, next) => linkedinController.createLead(req, res, next));
router.get("/connections/:id", (req, res, next) => linkedinController.getLeadById(req, res, next));
router.patch("/connections/:id", (req, res, next) => linkedinController.updateLead(req, res, next));
router.patch("/connections/:id/note", (req, res, next) =>
  linkedinController.updateLeadNote(req, res, next),
);
router.post("/connections/:id/approve", (req, res, next) =>
  linkedinController.sendConnectionRequest(req, res, next),
);
router.post("/connections/:id/mark-sent", (req, res, next) => linkedinController.markLeadSent(req, res, next));
router.post("/connections/:id/mark-connected", (req, res, next) =>
  linkedinController.markLeadConnected(req, res, next),
);
router.post("/connections/:id/skip", (req, res, next) =>
  linkedinController.skipOrWithdrawLead(req, res, next),
);
router.post("/connections/:id/withdraw", (req, res, next) =>
  linkedinController.skipOrWithdrawLead(req, res, next),
);
router.post("/connections/:id/restore", (req, res, next) =>
  linkedinController.restoreLead(req, res, next),
);
router.post("/connections/:id/add-to-leads", (req, res, next) =>
  linkedinController.addLeadToCrm(req, res, next),
);

/* ========================================================================
 * 4. LINKEDIN ACCOUNT (/api/linkedin/account) (#64-#66)
 * ======================================================================== */

router.get("/account", (req, res, next) => linkedinController.getAccount(req, res, next));
// Connecting or disconnecting an integration is for Owner and Admins only (the same rule as Settings > Integrations).
router.post("/account/connect", requireRole(Role.OWNER, Role.ADMIN), (req, res, next) =>
  linkedinController.connectAccount(req, res, next),
);
router.delete("/account", requireRole(Role.OWNER, Role.ADMIN), (req, res, next) =>
  linkedinController.disconnectAccount(req, res, next),
);

export const linkedinRoutes = router;
