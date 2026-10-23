/**
 * Extra fields (for example `code`) are sent to the browser next to `message`,
 * so the frontend can react to a specific situation (e.g. ACCOUNT_RESTORABLE) instead of parsing text.
 */
export type AppErrorDetails = { code?: string } & Record<string, unknown>;

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: AppErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
  }
}
