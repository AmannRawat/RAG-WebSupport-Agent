
import { crawlQueue } from "../config/queue.js";

export async function enqueueCrawl(url) {
  const job = await crawlQueue.add("crawl-website", { url });

  return {
    jobId: job.id,
    status: "queued",
    url,
  };
}

export async function getCrawlJob(jobId) {
  const job = await crawlQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  return {
    jobId: job.id,
    url: job.data.url,
    state: await job.getState(),
    progress: job.progress,
    result: job.returnvalue ?? null,
    failedReason: job.failedReason ?? null,
  };
}
