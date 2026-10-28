import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../../utils/app-error";
import { inboxService } from "./inbox.service";
import { createInboundMessageSchema } from "./inbox.schema";

const org = (req: Request) => {
  if (!req.user?.organizationId) throw new AppError("Authentication required", 401);
  return req.user.organizationId;
};
const replySchema = z.object({ instruction: z.string().trim().max(500).optional() });

export const inboxController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 160) : undefined;
      res.json({ messages: await inboxService.list(org(req), q) });
    } catch (error) { next(error); }
  },
  recordInbound: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createInboundMessageSchema.parse(req.body);
      res.status(201).json({ message: await inboxService.recordInbound(org(req), input) });
    } catch (error) { next(error); }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await inboxService.get(org(req), String(req.params.id))); }
    catch (error) { next(error); }
  },
  draftReply: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = replySchema.parse(req.body ?? {});
      res.status(201).json({ draft: await inboxService.draftReply(org(req), String(req.params.id), input.instruction) });
    } catch (error) { next(error); }
  },
  markSent: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ message: await inboxService.markSent(org(req), String(req.params.id)) }); }
    catch (error) { next(error); }
  },
};
