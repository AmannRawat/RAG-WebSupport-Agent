import { crawlWebsite } from "./crawler.service.js";

export async function processCrawlJob(job) {
  const { url } = job.data;

  console.log(`\n[Worker] Starting crawl job ${job.id}`);
  console.log(`[Worker] Website: ${url}`);

  await job.updateProgress(10);

  const result = await crawlWebsite(url, {
    jobId: String(job.id),
  });

  console.log(`[Worker] Job ${job.id} result:`, result);

  if (result.status === "failed") {
    throw new Error(
      `Crawl failed: no pages were processed successfully for ${url}`
    );
  }

  await job.updateProgress(100);

  return result;
}