import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/app-error";
import { notify } from "../../utils/notify";
import { createLeadSchema, draftEmailSchema, importLeadsSchema, listLeadsQuerySchema, updateLeadSchema } from "./leads.schema";
import { leadsService } from "./leads.service";

const org = (req: Request) => {
  if (!req.user?.organizationId) throw new AppError("Authentication required", 401);
  return req.user.organizationId;
};

export const leadsController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listLeadsQuerySchema.parse(req.query);
      res.json(await leadsService.list(org(req), query));
    } catch (error) { next(error); }
  },
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createLeadSchema.parse(req.body);
      const organizationId = org(req);
      const lead = await leadsService.create(organizationId, input);
      await notify({ organizationId, type: "lead", title: "New lead added", body: `${lead.name} was added to the lead pipeline.`, href: `/leads/${lead.id}`, audience: "ALL", exceptUserId: req.user!.userId });
      res.status(201).json({ lead });
    } catch (error) { next(error); }
  },
  import: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = importLeadsSchema.parse(req.body);
      const organizationId = org(req);
      const result = await leadsService.import(organizationId, input.leads);
      if (result.importedCount) {
        await notify({ organizationId, type: "lead", title: "Leads imported", body: `${result.importedCount} ${result.importedCount === 1 ? "lead was" : "leads were"} added to the lead pipeline.`, href: "/leads", audience: "ALL", exceptUserId: req.user!.userId });
      }
      res.status(201).json(result);
    } catch (error) { next(error); }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ lead: await leadsService.get(org(req), String(req.params.id)) }); }
    catch (error) { next(error); }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = updateLeadSchema.parse(req.body);
      res.json({ lead: await leadsService.update(org(req), String(req.params.id), input) });
    } catch (error) { next(error); }
  },
  archive: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await leadsService.archive(org(req), String(req.params.id))); }
    catch (error) { next(error); }
  },
  draftEmail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = draftEmailSchema.parse(req.body ?? {});
      res.status(201).json({ draft: await leadsService.draftEmail(org(req), String(req.params.id), input.instruction) });
    } catch (error) { next(error); }
  },
};
