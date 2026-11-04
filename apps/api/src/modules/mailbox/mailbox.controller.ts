import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/app-error";
import { connectMailboxSchema, mailboxSettingsSchema, sendDraftSchema, syncMailboxSchema } from "./mailbox.schema";
import { mailboxService } from "./mailbox.service";

const org = (req: Request) => {
  if (!req.user?.organizationId) throw new AppError("Authentication required", 401);
  return req.user.organizationId;
};

export const mailboxController = {
  status: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ mailbox: await mailboxService.status(org(req)) }); } catch (error) { next(error); }
  },
  connect: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = connectMailboxSchema.parse(req.body);
      res.status(201).json({ mailbox: await mailboxService.connect(org(req), req.user!.userId, { ...input, fromName: input.fromName || undefined }) });
    } catch (error) { next(error); }
  },
  settings: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ mailbox: await mailboxService.updateSettings(org(req), mailboxSettingsSchema.parse(req.body)) }); } catch (error) { next(error); }
  },
  disconnect: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await mailboxService.disconnect(org(req))); } catch (error) { next(error); }
  },
  sync: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lookbackDays } = syncMailboxSchema.parse(req.body ?? {});
      const result = await mailboxService.syncNow(org(req), lookbackDays);
      res.json({ result, mailbox: await mailboxService.status(org(req)) });
    } catch (error) { next(error); }
  },
  sendDraft: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const edits = sendDraftSchema.parse(req.body ?? {});
      res.json(await mailboxService.sendDraft(org(req), String(req.params.id), edits));
    } catch (error) { next(error); }
  },
};
