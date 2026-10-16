
import { describe, it, expect, vi, beforeEach } from "vitest";

const { crawlWebsite } = vi.hoisted(() => ({
  crawlWebsite: vi.fn(),
}));

vi.mock("./crawler.service.js", () => ({
  crawlWebsite,
}));

import { processCrawlJob } from "./crawlJobProcessor.js";

describe("processCrawlJob", () => {
  let job;

  beforeEach(() => {
    vi.clearAllMocks();

    job = {
      id: "job-123",
      data: {
        url: "https://example.com/",
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("reports page progress and returns a successful crawl result", async () => {
    const result = {
      status: "completed",
      processedPages: 5,
      failedPages: 0,
      indexedChunks: 20,
    };

    crawlWebsite.mockImplementation(async (url, options) => {
      expect(url).toBe("https://example.com/");
      expect(options.jobId).toBe("job-123");
      expect(options.onProgress).toEqual(expect.any(Function));

      await options.onProgress({
        processedPages: 5,
        discoveredPages: 5,
        failedPages: 0,
        maxPages: 20,
      });

      return result;
    });

    const returnedResult = await processCrawlJob(job);

    expect(crawlWebsite).toHaveBeenCalledTimes(1);
    expect(job.updateProgress).toHaveBeenNthCalledWith(1, 5);
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, 24);
    expect(job.updateProgress).toHaveBeenNthCalledWith(3, 100);
    expect(returnedResult).toEqual(result);
  });

  it("returns partial results without throwing", async () => {
    const result = {
      status: "partial",
      processedPages: 3,
      failedPages: 2,
      indexedChunks: 12,
    };

    crawlWebsite.mockResolvedValue(result);

    await expect(processCrawlJob(job)).resolves.toEqual(result);

    expect(job.updateProgress).toHaveBeenNthCalledWith(1, 5);
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, 100);
  });

  it("throws when the crawl result is failed", async () => {
    crawlWebsite.mockResolvedValue({
      status: "failed",
      processedPages: 0,
      failedPages: 5,
      indexedChunks: 0,
    });

    await expect(processCrawlJob(job)).rejects.toThrow(
      "Crawl failed: no pages were processed successfully for https://example.com/"
    );

    expect(job.updateProgress).toHaveBeenCalledTimes(1);
    expect(job.updateProgress).toHaveBeenCalledWith(5);
  });

  it("propagates infrastructure errors so BullMQ can retry", async () => {
    crawlWebsite.mockRejectedValue(new Error("Qdrant unavailable"));

    await expect(processCrawlJob(job)).rejects.toThrow(
      "Qdrant unavailable"
    );
  });

  it("propagates progress callback errors", async () => {
    crawlWebsite.mockImplementation(async (url, options) => {
      await options.onProgress({
        processedPages: 1,
        discoveredPages: 1,
        failedPages: 0,
        maxPages: 20,
      });

      return {
        status: "completed",
        processedPages: 1,
        failedPages: 0,
        indexedChunks: 2,
      };
    });

    job.updateProgress
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Progress update failed"));

    await expect(processCrawlJob(job)).rejects.toThrow(
      "Progress update failed"
    );
  });
});