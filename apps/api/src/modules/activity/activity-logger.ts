import { prisma } from "@ai-sales-agent/database";

type LinkedinActivityKind = "research" | "draft" | "discover" | "analyze" | "sync" | "enrich" | "invite" | "followup";

/** Records a real LinkedIn operation in the same feed shown by the Activity page. */
export async function trackLinkedinActivity<T>(input: {
  organizationId: string;
  kind: LinkedinActivityKind;
  title: string;
  context?: string;
  run: () => Promise<T>;
  output: (result: T) => string;
}): Promise<T> {
  const started = Date.now();
  let activityId: string | undefined;
  try {
    const row = await prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        kind: input.kind,
        title: input.title,
        leadContext: input.context ?? "",
        agent: "LinkedIn Agent",
        status: "running",
        startedAt: new Date(started),
      },
      select: { id: true },
    });
    activityId = row.id;
  } catch (error) {
    // Logging must not make a working LinkedIn action fail; the API still reports database errors normally.
    console.error("[activity] could not create LinkedIn activity record:", error);
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
        console.error("[activity] could not complete LinkedIn activity record:", error);
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
            error: (error instanceof Error ? error.message : "LinkedIn task failed").slice(0, 1000),
          },
        });
      } catch (logError) {
        console.error("[activity] could not fail LinkedIn activity record:", logError);
      }
    }
    throw error;
  }
}
