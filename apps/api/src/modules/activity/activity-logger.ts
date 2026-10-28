import { prisma } from "@ai-sales-agent/database";

type ActivityKind = "research" | "draft" | "discover" | "analyze" | "sync" | "enrich" | "invite" | "followup" | "lead";
type TrackActivityInput<T> = {
  organizationId: string;
  kind: ActivityKind;
  title: string;
  context?: string;
  leadName?: string;
  agent?: "General Agent" | "LinkedIn Agent";
  run: () => Promise<T>;
  output: (result: T) => string;
};

/** Records a real operation in the same feed shown by the Activity page. */
export async function trackActivity<T>(input: TrackActivityInput<T>): Promise<T> {
  const started = Date.now();
  let activityId: string | undefined;
  try {
    const row = await prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        kind: input.kind,
        title: input.title,
        leadName: input.leadName ?? null,
        leadContext: input.context ?? "",
        agent: input.agent ?? "General Agent",
        status: "running",
        startedAt: new Date(started),
      },
      select: { id: true },
    });
    activityId = row.id;
  } catch (error) {
    // Logging must not make a working action fail; the API still reports database errors normally.
    console.error("[activity] could not create activity record:", error);
  }

  try {
    const result = await input.run();
    if (activityId) {
      try {
        await prisma.activityLog.update({
          where: { id: activityId },
          data: {
            status: "completed",
            durationSec: Math.max(0, Math.round((Date.now() - started) / 1000)),
            output: input.output(result).slice(0, 2000),
          },
        });
      } catch (error) {
        console.error("[activity] could not complete activity record:", error);
      }
    }
    return result;
  } catch (error) {
    if (activityId) {
      try {
        await prisma.activityLog.update({
          where: { id: activityId },
          data: {
            status: "failed",
            durationSec: Math.max(0, Math.round((Date.now() - started) / 1000)),
            error: (error instanceof Error ? error.message : "Task failed").slice(0, 1000),
          },
        });
      } catch (logError) {
        console.error("[activity] could not fail activity record:", logError);
      }
    }
    throw error;
  }
}

/** Records a real LinkedIn operation with the LinkedIn Agent label. */
export function trackLinkedinActivity<T>(input: Omit<TrackActivityInput<T>, "agent">): Promise<T> {
  return trackActivity({ ...input, agent: "LinkedIn Agent" });
}
