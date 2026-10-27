export type NotificationType = "reply" | "approval" | "failure" | "lead" | "team" | "system";

/**
 * Backend contract:  GET /api/notifications  ->  { data: AppNotification[] }  (newest first, only what THIS person may see)
 *                             PATCH /api/notifications/:id { read }   POST /api/notifications/read-all
 *                             DELETE /api/notifications/:id           DELETE /api/notifications
 */
export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** ISO timestamp */
  at: string;
  read: boolean;
  /** Where clicking it goes (null = nowhere, just marks it as read). */
  href: string | null;
};
