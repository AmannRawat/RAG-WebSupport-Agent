import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  scrapeReactWebsite: vi.fn(),
  chunkText: vi.fn(),
  generateVectorEmbedding: vi.fn(),
  storeChunk: vi.fn(),
  getVectorCount: vi.fn(),
  validatePublicHttpUrl: vi.fn(),
  getPageCheckpoint: vi.fn(),
  savePageCheckpoint: vi.fn(),
}));

vi.mock("./scraper.service.js", () => ({
  scrapeReactWebsite: mocks.scrapeReactWebsite,
}));

vi.mock("./chunking.service.js", () => ({
  chunkText: mocks.chunkText,
}));

vi.mock("./embedding.service.js", () => ({
  generateVectorEmbedding: mocks.generateVectorEmbedding,
}));

vi.mock("./vectorStore.service.js", () => ({
  storeChunk: mocks.storeChunk,
  getVectorCount: mocks.getVectorCount,
}));

vi.mock("../security/urlSafety.js", () => ({
  validatePublicHttpUrl: mocks.validatePublicHttpUrl,
}));

vi.mock("./crawlCheckpoint.service.js", () => ({
  getPageCheckpoint: mocks.getPageCheckpoint,
  savePageCheckpoint: mocks.savePageCheckpoint,
}));

import { crawlWebsite } from "./crawler.service.js";

describe("crawlWebsite", () => {
  const url = "https://example.com/";
  const jobId = "job-123";

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.validatePublicHttpUrl.mockResolvedValue(undefined);

    mocks.getPageCheckpoint.mockResolvedValue(null);

    mocks.scrapeReactWebsite.mockResolvedValue({
      head: "Example website title",
      body: "Example website body",
      internalLinks: [],
    });

    mocks.chunkText.mockReturnValue(["First chunk", "Second chunk"]);

    mocks.generateVectorEmbedding.mockResolvedValue([0.1, 0.2]);

    mocks.storeChunk.mockResolvedValue(undefined);

    mocks.savePageCheckpoint.mockResolvedValue(undefined);

    mocks.getVectorCount.mockResolvedValue(3);
  });

  it("indexes page content and saves a checkpoint", async () => {
    const result = await crawlWebsite(url, { jobId });

    expect(mocks.scrapeReactWebsite).toHaveBeenCalledWith(url);

    expect(mocks.generateVectorEmbedding).toHaveBeenCalledTimes(3);

    expect(mocks.storeChunk).toHaveBeenCalledTimes(3);

    expect(mocks.savePageCheckpoint).toHaveBeenCalledWith(
      jobId,
      url,
      {
        indexedChunks: 2,
        internalLinks: [],
      }
    );

    expect(result).toMatchObject({
      processedPages: 1,
      failedPages: 0,
      indexedChunks: 2,
      status: "completed",
    });
  });

  it("skips a page that already has a valid checkpoint", async () => {
    mocks.getPageCheckpoint.mockResolvedValue({
      indexedChunks: 4,
      internalLinks: [],
    });

    const result = await crawlWebsite(url, { jobId });

    expect(mocks.scrapeReactWebsite).not.toHaveBeenCalled();
    expect(mocks.storeChunk).not.toHaveBeenCalled();

    expect(result).toMatchObject({
      processedPages: 1,
      indexedChunks: 4,
      status: "completed",
    });
  });

  it("crawls same-origin links but rejects external links", async () => {
    mocks.scrapeReactWebsite
      .mockResolvedValueOnce({
        head: "Example website title",
        body: "Example website body",
        internalLinks: [
          "https://example.com/about",
          "https://another-site.com/private",
        ],
      })
      .mockResolvedValueOnce({
        head: "About page",
        body: "About page body",
        internalLinks: [],
      });

    await crawlWebsite(url, { jobId });

    // The starting page and same-origin page should be crawled.
    expect(mocks.scrapeReactWebsite).toHaveBeenCalledTimes(2);
    expect(mocks.scrapeReactWebsite).toHaveBeenCalledWith(
      "https://example.com/"
    );
    expect(mocks.scrapeReactWebsite).toHaveBeenCalledWith(
      "https://example.com/about"
    );

    // External links must never be crawled.
    expect(mocks.scrapeReactWebsite).not.toHaveBeenCalledWith(
      "https://another-site.com/private"
    );
  });

  it("rejects a starting URL that fails security validation", async () => {
    mocks.validatePublicHttpUrl.mockRejectedValue(
      new Error("Blocked private network address")
    );

    await expect(crawlWebsite(url, { jobId })).rejects.toThrow(
      "Starting URL failed security validation"
    );

    expect(mocks.scrapeReactWebsite).not.toHaveBeenCalled();
  });

  it("requires a BullMQ job ID for checkpointing", async () => {
    await expect(crawlWebsite(url)).rejects.toThrow(
      "crawlWebsite requires a BullMQ jobId for checkpointing."
    );
  });
});