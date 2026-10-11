
import "dotenv/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl =
  process.env.VALKEY_URL || "redis://127.0.0.1:6380";

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const crawlQueue = new Queue("website-support-crawl", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
