import { prisma } from "@ai-sales-agent/database";

type ActivityKind = "research" | "draft" | "discover" | "analyze" | "sync" | "enrich" | "invite" | "followup" | "lead" | "video";
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

/**
 * Records a task that keeps running after the request that started it has returned (a video that is rendered by D-ID).
 * It stays "running" in the Activity feed until finishScriptVideoActivity() closes it.
 */
export async function beginScriptVideoActivity(input: { organizationId: string; scriptId: string; scriptTitle: string }) {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId: input.organizationId,
        kind: "video",
        title: "Create topic video",
        leadContext: input.scriptTitle,
        agent: "LinkedIn Agent",
        status: "running",
        startedAt: new Date(),
        metadata: { scriptId: input.scriptId },
      },
    });
  } catch (error) {
    console.error("[activity] could not create video activity record:", error);
  }
}

/** Closes every running video task of this script as completed or failed. Safe to call more than once. */
export async function finishScriptVideoActivity(
  organizationId: string,
  scriptId: string,
  result: { ok: true; output: string } | { ok: false; error: string },
) {
  try {
    const running = await prisma.activityLog.findMany({
      where: { organizationId, kind: "video", status: "running", metadata: { path: ["scriptId"], equals: scriptId } },
      select: { id: true, startedAt: true },
    });
    for (const row of running) {
      await prisma.activityLog.update({
        where: { id: row.id },
        data: {
          status: result.ok ? "completed" : "failed",
          durationSec: row.startedAt ? Math.max(0, Math.round((Date.now() - row.startedAt.getTime()) / 1000)) : null,
          output: result.ok ? result.output.slice(0, 2000) : null,
          error: result.ok ? null : result.error.slice(0, 1000),
        },
      });
    }
  } catch (error) {
    console.error("[activity] could not finish video activity record:", error);
  }
}

/** Records a real LinkedIn operation with the LinkedIn Agent label. */
export function trackLinkedinActivity<T>(input: Omit<TrackActivityInput<T>, "agent">): Promise<T> {
  return trackActivity({ ...input, agent: "LinkedIn Agent" });
}
