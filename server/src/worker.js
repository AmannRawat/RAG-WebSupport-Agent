import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processCrawlJob } from "./services/crawlJobProcessor.js";

const connection = new IORedis(
  process.env.VALKEY_URL || "redis://127.0.0.1:6380",
  {
    maxRetriesPerRequest: null,
  }
);

const worker = new Worker(
  "website-support-crawl",
  processCrawlJob,
  {
    connection,
    concurrency: 1,
  }
);

worker.on("ready", () => {
  console.log("[Worker] Connected to Valkey and ready for jobs.");
});

worker.on("completed", (job, result) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
  console.log("[Worker] Result:", result);
});

worker.on("failed", (job, error) => {
  console.error(
    `[Worker] Job ${job?.id ?? "unknown"} failed:`,
    error.message
  );
});

worker.on("error", (error) => {
  console.error("[Worker] Error:", error.message);
});

async function shutdown(signal) {
  console.log(`\n[Worker] Received ${signal}. Shutting down...`);

  try {
    await worker.close();
    await connection.quit();
    console.log("[Worker] Shutdown complete.");
    process.exit(0);
  } catch (error) {
    console.error("[Worker] Shutdown error:", error);
    process.exit(1);
  }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));