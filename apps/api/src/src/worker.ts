import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "./config/env";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "sales-agent-jobs",
  async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);

    // Sales research, email generation, and follow-up
    // jobs will be implemented in later project steps.
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed.`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id ?? "unknown"} failed:`, error.message);
});

console.log("Sales agent background worker started.");
