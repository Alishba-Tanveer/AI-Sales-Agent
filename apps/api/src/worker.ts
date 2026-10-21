import {
  initBullMqWorker,
  runPurgeExpiredDataJob,
} from "./queue/job-queue";

const worker = initBullMqWorker();

if (worker) {
  worker.on("completed", (job) => {
    console.log(`[WORKER] Job ${job.id} (${job.name}) completed.`);
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[WORKER] Job ${job?.id ?? "unknown"} (${job?.name ?? "unknown"}) failed:`,
      error.message
    );
  });
}

// Run 30-day soft-delete & expired-invite purge job on startup and every 24 hours
runPurgeExpiredDataJob()
  .then((summary) => {
    console.log(
      `[WORKER PURGE JOB] Initial cleanup complete: ${summary.purgedUsers} expired accounts, ${summary.purgedInvitations} expired invites removed.`
    );
  })
  .catch((err) => {
    console.error("[WORKER PURGE JOB] Error during initial cleanup:", err.message);
  });

setInterval(() => {
  runPurgeExpiredDataJob().catch((err) => {
    console.error("[WORKER PURGE JOB] Scheduled cleanup error:", err.message);
  });
}, 24 * 60 * 60 * 1000);

console.log("Sales agent background worker started.");
