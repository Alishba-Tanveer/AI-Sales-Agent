export type MailboxStatus =
  | { connected: false; testRedirectTo: string | null }
  | {
      connected: true;
      email: string;
      fromName: string | null;
      status: "connected" | "error";
      lastError: string | null;
      lastSyncedAt: string | null;
      autoSync: boolean;
      autoDraft: boolean;
      dailyLimit: number;
      sentToday: number;
      testRedirectTo: string | null;
    };

export type SyncResult = { checked: number; imported: number; drafted: number; skipped: number; bounced: number; baseline: boolean };

export type ConnectInput = {
  email: string;
  password: string;
  fromName?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
};

export type ReplyIntent = "interested" | "question" | "not_interested" | "unsubscribe" | "out_of_office" | "other";
