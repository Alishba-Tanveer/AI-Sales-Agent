import { Request, Response, NextFunction } from "express";
import { trackLinkedinActivity } from "../activity/activity-logger";
import { notify } from "../../utils/notify";
import { linkedinService } from "./linkedin.service";
import {
  analyzeProfileSchema,
  approveScriptSchema,
  bulkApproveScriptsSchema,
  checkPostStatusSchema,
  connectAccountSchema,
  createLeadSchema,
  createScriptSchema,
  importLeadsSchema,
  importProfilePdfSchema,
  markAppliedSchema,
  markPostedSchema,
  updateContentSettingsSchema,
  updateContentSourcesSchema,
  updateGroundingFactSchema,
  updateLeadNoteSchema,
  updateLeadSchema,
  updateScriptSchema,
  updateStrategySchema,
  updateSuggestionSchema,
} from "./linkedin.schema";

export class LinkedinController {
  /* ========================================================================
   * 1. PROFILE OPTIMIZER
   * ======================================================================== */

  async getProfileAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await linkedinService.getProfileAudit(req.user!.organizationId);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async analyzeProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = analyzeProfileSchema.parse(req.body ?? {});
      const organizationId = req.user!.organizationId;
      const result = await trackLinkedinActivity({
        organizationId,
        kind: "analyze",
        title: "Review LinkedIn profile",
        run: () => linkedinService.analyzeProfile(organizationId, validated),
        output: (value) => `Profile review completed with ${value.suggestions.length} suggestions.`,
      });
      res.status(200).json({
        success: true,
        message: "Profile read. Your changes are ready.",
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async importProfilePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = importProfilePdfSchema.parse(req.body ?? {});
      const result = await linkedinService.importProfilePdf(validated.pdfBase64);
      res.status(200).json({ success: true, message: "PDF read. Check the text below.", data: result, ...result });
    } catch (error) {
      next(error);
    }
  }

  async updateRecommendation(req: Request, res: Response, next: NextFunction) {
    try {
      const keyOrId = String(req.params.id || req.params.key || "");
      const validated = updateSuggestionSchema.parse(req.body ?? {});
      const result = await linkedinService.updateRecommendation(
        req.user!.organizationId,
        keyOrId,
        validated,
      );
      res.status(200).json({
        success: true,
        message: "Recommendation updated",
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async markApplied(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = markAppliedSchema.parse(req.body ?? {});
      const result = await linkedinService.markRecommendationsApplied(
        req.user!.organizationId,
        validated,
      );
      res.status(200).json({
        success: true,
        message: "Marked as done",
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGroundingFacts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await linkedinService.getGroundingFacts(req.user!.organizationId);
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateGroundingFact(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateGroundingFactSchema.parse(req.body ?? {});
      const result = await linkedinService.updateGroundingFact(
        req.user!.organizationId,
        String(req.params.key),
        validated,
      );
      res.status(200).json({
        success: true,
        message: "Grounding fact updated",
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfileHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await linkedinService.getProfileHistory(req.user!.organizationId);
      res.status(200).json({
        success: true,
        data: history,
        history,
      });
    } catch (error) {
      next(error);
    }
  }

  /* ========================================================================
   * 2. CONTENT ENGINE & VIDEO SCRIPTS
   * ======================================================================== */

  async listScripts(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, source, search } = req.query as Record<string, string | undefined>;
      const result = await linkedinService.listScripts(req.user!.organizationId, {
        status,
        source,
        search,
      });
      res.status(200).json({
        success: true,
        data: result.scripts,
        scripts: result.scripts,
        counts: result.counts,
        settings: result.settings,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshNews(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const result = await trackLinkedinActivity({
        organizationId,
        kind: "research",
        title: "Research niche news",
        run: () => linkedinService.refreshNews(organizationId),
        output: () => "Niche news research completed.",
      });
      res.status(201).json({ success: true, data: result, ...result });
    }
    catch(error){next(error);}
  }

  async getScriptById(req: Request, res: Response, next: NextFunction) {
    try {
      const script = await linkedinService.getScriptById(
        req.user!.organizationId,
        String(req.params.id),
      );
      res.status(200).json({
        success: true,
        data: script,
        ...script,
      });
    } catch (error) {
      next(error);
    }
  }

  async createScript(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createScriptSchema.parse(req.body ?? {});
      const organizationId = req.user!.organizationId;
      const script = await trackLinkedinActivity({
        organizationId,
        kind: "draft",
        title: "Write LinkedIn video script",
        context: validated.topic ?? validated.title ?? "User-provided topic",
        run: () => linkedinService.createScript(organizationId, validated),
        output: (value) => `Draft created for review: ${value.title}`,
      });
      res.status(201).json({
        success: true,
        message: "Topic added. A script draft is ready for you to review.",
        data: script,
        ...script,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateScript(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateScriptSchema.parse(req.body ?? {});
      const script = await linkedinService.updateScript(
        req.user!.organizationId,
        String(req.params.id),
        validated,
      );
      res.status(200).json({
        success: true,
        message: "Script updated",
        data: script,
        ...script,
      });
    } catch (error) {
      next(error);
    }
  }

  async approveScript(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = approveScriptSchema.parse(req.body ?? {});
      const script = await linkedinService.approveScript(
        req.user!.organizationId,
        String(req.params.id),
        validated,
      );
      res.status(200).json({
        success: true,
        message: "Approved. The script is ready for you to record.",
        data: script,
        ...script,
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkApproveScripts(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = bulkApproveScriptsSchema.parse(req.body ?? {});
      const result = await linkedinService.bulkApproveScripts(req.user!.organizationId, validated);
      res.status(200).json({
        success: true,
        message: `${result.approvedCount} script(s) approved`,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async regenerateScript(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const script = await trackLinkedinActivity({
        organizationId,
        kind: "draft",
        title: "Rewrite LinkedIn video script",
        run: () => linkedinService.regenerateScript(organizationId, String(req.params.id)),
        output: (value) => `Rewritten draft ready for review: ${value.title}`,
      });
      res.status(200).json({
        success: true,
        message: "New draft written",
        data: script,
        ...script,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteScript(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await linkedinService.deleteScript(
        req.user!.organizationId,
        String(req.params.id),
      );
      res.status(200).json({
        success: true,
        message: "Script removed",
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async markScriptPosted(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = markPostedSchema.parse(req.body ?? {});
      const script = await linkedinService.markScriptPosted(
        req.user!.organizationId,
        String(req.params.id),
        validated,
      );
      res.status(200).json({
        success: true,
        message: "Nice. Marked as posted.",
        data: script,
        ...script,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkPostStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = checkPostStatusSchema.parse(req.body ?? {});
      const result = await linkedinService.checkPostStatus(req.user!.organizationId, validated);
      res.status(200).json({
        success: true,
        status: result.status,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getContentSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await linkedinService.getContentSettings(req.user!.organizationId);
      res.status(200).json({
        success: true,
        data: settings,
        ...settings,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateContentSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateContentSettingsSchema.parse(req.body ?? {});
      const settings = await linkedinService.updateContentSettings(
        req.user!.organizationId,
        validated,
      );
      res.status(200).json({
        success: true,
        message: "Posting settings saved",
        data: settings,
        ...settings,
      });
    } catch (error) {
      next(error);
    }
  }

  async getContentSources(req: Request, res: Response, next: NextFunction) {
    try {
      const sources = await linkedinService.getContentSources(req.user!.organizationId);
      res.status(200).json({
        success: true,
        data: sources,
        sources,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateContentSources(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateContentSourcesSchema.parse(req.body ?? {});
      const sources = await linkedinService.updateContentSources(
        req.user!.organizationId,
        validated.sources.map((s) => ({ ...s, enabled: s.enabled ?? true })),
      );
      res.status(200).json({
        success: true,
        message: "Content sources updated",
        data: sources,
        sources,
      });
    } catch (error) {
      next(error);
    }
  }

  async downloadVideoScript(req: Request, res: Response, next: NextFunction) {
    try {
      const script = await linkedinService.getScriptById(
        req.user!.organizationId,
        String(req.params.id),
      );
      const caption = `${script.hook}\n\n${script.points.map((p) => `• ${p}`).join("\n")}\n\n${script.cta}`;
      const result = {
        id: script.id,
        title: script.title,
        status: script.status,
        seconds: script.seconds,
        words: script.words,
        caption,
        videoUrl: null,
      };
      res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }


  async getStrategy(req: Request, res: Response, next: NextFunction) {
    try {
      const strategy = await linkedinService.getStrategy(req.user!.organizationId);
      res.status(200).json({
        success: true,
        data: strategy,
        ...strategy,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStrategy(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateStrategySchema.parse(req.body ?? {});
      const strategy = await linkedinService.updateStrategy(req.user!.organizationId, validated);
      res.status(200).json({
        success: true,
        data: strategy,
        ...strategy,
      });
    } catch (error) {
      next(error);
    }
  }

  async listLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const { tab, status, source, search } = req.query as Record<string, string | undefined>;
      const result = await linkedinService.listLeads(req.user!.organizationId, {
        tab,
        status,
        source,
        search,
      });
      res.status(200).json({
        success: true,
        data: result.leads,
        leads: result.leads,
        counts: result.counts,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeadById(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await linkedinService.getLeadById(
        req.user!.organizationId,
        String(req.params.id),
      );
      res.status(200).json({
        success: true,
        data: lead,
        ...lead,
      });
    } catch (error) {
      next(error);
    }
  }

  async createLead(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createLeadSchema.parse(req.body ?? {});
      const lead = await linkedinService.createLead(req.user!.organizationId, validated);
      res.status(201).json({
        success: true,
        message: `${lead.name} added`,
        data: lead,
        ...lead,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateLead(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateLeadSchema.parse(req.body ?? {});
      const lead = await linkedinService.updateLead(
        req.user!.organizationId,
        String(req.params.id),
        validated,
      );
      res.status(200).json({
        success: true,
        message: "Person updated",
        data: lead,
        ...lead,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateLeadNote(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = updateLeadNoteSchema.parse(req.body ?? {});
      const id = String(req.params.id);
      const lead = validated.send
        ? await linkedinService.sendConnectionRequest(
            req.user!.organizationId,
            id,
            validated.note,
          )
        : await linkedinService.updateLead(req.user!.organizationId, id, {
            note: validated.note,
          });
      res.status(200).json({
        success: true,
        message: validated.send ? `Request sent to ${lead.name}` : `Message saved for ${lead.name}`,
        data: lead,
        ...lead,
      });
    } catch (error) {
      next(error);
    }
  }

  async sendConnectionRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const note = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;
      if (note !== undefined && note.length > 300) {
        updateLeadNoteSchema.parse({ note });
      }
      const lead = await linkedinService.sendConnectionRequest(
        req.user!.organizationId,
        String(req.params.id),
        note,
      );
      res.status(200).json({
        success: true,
        message: `Connection note saved for ${lead.name}. Send it manually on LinkedIn.`,
        data: lead,
        ...lead,
      });
    } catch (error) {
      next(error);
    }
  }

  async markLeadSent(req: Request, res: Response, next: NextFunction) {
    try { const lead=await linkedinService.markLeadSent(req.user!.organizationId,String(req.params.id)); res.status(200).json({success:true,message:"Marked as sent after your manual LinkedIn action.",data:lead,...lead}); }
    catch(error){next(error);}
  }

  async skipOrWithdrawLead(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await linkedinService.skipOrWithdrawLead(
        req.user!.organizationId,
        String(req.params.id),
      );
      res.status(200).json({
        success: true,
        message: `Skipped ${lead.name}`,
        data: lead,
        ...lead,
      });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /leads/:id, or POST /leads/bulk-delete { ids } */
  async deleteLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const ids = req.params.id
        ? [String(req.params.id)]
        : Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const result = await linkedinService.deleteLeads(req.user!.organizationId, ids);
      res.status(200).json({
        success: true,
        message: `Deleted ${result.deletedCount} ${result.deletedCount === 1 ? "person" : "people"}.`,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async restoreLead(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await linkedinService.restoreLead(
        req.user!.organizationId,
        String(req.params.id),
      );
      res.status(200).json({
        success: true,
        message: `Restored ${lead.name}`,
        data: lead,
        ...lead,
      });
    } catch (error) {
      next(error);
    }
  }

  async markLeadConnected(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await linkedinService.markLeadConnected(
        req.user!.organizationId,
        String(req.params.id),
      );
      res.status(200).json({
        success: true,
        message: `${lead.name} marked as connected`,
        data: lead,
        ...lead,
      });
    } catch (error) {
      next(error);
    }
  }

  async discoverConnections(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const result = await trackLinkedinActivity({
        organizationId,
        kind: "discover",
        title: "Research target buyers",
        run: () => linkedinService.discoverConnections(organizationId),
        output: () => "Buyer research completed. Review the suggested buyers before reaching out.",
      });
      res.status(201).json({
        success: true,
        message: "Buyer research completed",
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async importLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = importLeadsSchema.parse(req.body ?? {});
      const result = await linkedinService.importLeads(req.user!.organizationId, validated);
      res.status(201).json({
        success: true,
        message: `Imported ${result.importedCount} person(s)`,
        data: result,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  async addLeadToCrm(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await linkedinService.addLeadToCrm(
        req.user!.organizationId,
        String(req.params.id),
      );
      const crmLead = result.lead;
      if (result.created) {
        await notify({ organizationId: req.user!.organizationId, type: "lead", title: "New lead added", body: `${crmLead.name} was added from LinkedIn to the lead pipeline.`, href: `/leads/${crmLead.id}`, audience: "ALL", exceptUserId: req.user!.userId });
      }
      res.status(201).json({
        success: true,
        message: `${crmLead.name} added to Leads`,
        data: crmLead,
        ...crmLead,
      });
    } catch (error) {
      next(error);
    }
  }

  /* ========================================================================
   * 4. LINKEDIN ACCOUNT
   * ======================================================================== */

  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await linkedinService.getAccount(req.user!.organizationId);
      res.status(200).json({
        success: true,
        data: account,
        ...account,
      });
    } catch (error) {
      next(error);
    }
  }

}

export const linkedinController = new LinkedinController();
