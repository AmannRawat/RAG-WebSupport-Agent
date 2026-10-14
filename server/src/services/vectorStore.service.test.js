import { describe, it, expect, vi, beforeEach } from "vitest";

const { getWebCollection } = vi.hoisted(() => ({
  getWebCollection: vi.fn(),
}));

vi.mock("../config/chroma.js", () => ({
  getWebCollection,
}));

import {
  storeChunk,
  retrieveChunks,
  getVectorCount,
} from "./vectorStore.service.js";

describe("vectorStore.service", () => {
  let collection;

  beforeEach(() => {
    vi.clearAllMocks();

    collection = {
      upsert: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        documents: [["Relevant website content"]],
        metadatas: [[
          {
            url: "https://example.com/about",
            websiteUrl: "https://example.com",
            title: "About",
          },
        ]],
      }),
      count: vi.fn().mockResolvedValue(5),
    };

    getWebCollection.mockResolvedValue(collection);
  });

  describe("storeChunk", () => {
    it("stores a chunk with its embedding and metadata", async () => {
      await storeChunk({
        id: "chunk-1",
        embedding: [0.1, 0.2, 0.3],
        url: "https://example.com/about",
        websiteUrl: "https://example.com",
        text: "Relevant website content",
        title: "About",
      });

      expect(collection.upsert).toHaveBeenCalledWith({
        ids: ["chunk-1"],
        embeddings: [[0.1, 0.2, 0.3]],
        documents: ["Relevant website content"],
        metadatas: [
          {
            url: "https://example.com/about",
            websiteUrl: "https://example.com",
            title: "About",
          },
        ],
      });
    });

    it("defaults the title to an empty string", async () => {
      await storeChunk({
        id: "chunk-2",
        embedding: [0.4, 0.5],
        url: "https://example.com/",
        websiteUrl: "https://example.com",
        text: "Home page",
      });

      expect(collection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadatas: [
            expect.objectContaining({ title: "" }),
          ],
        })
      );
    });
  });

  describe("retrieveChunks", () => {
    it("filters by website and requests the top three results", async () => {
      await retrieveChunks(
        [0.1, 0.2, 0.3],
        "https://example.com"
      );

      expect(collection.query).toHaveBeenCalledWith({
        queryEmbeddings: [[0.1, 0.2, 0.3]],
        nResults: 3,
        where: { websiteUrl: "https://example.com" },
        include: ["metadatas", "documents"],
      });
    });

    it("supports a custom result limit", async () => {
      await retrieveChunks(
        [0.1, 0.2],
        "https://example.com",
        5
      );

      expect(collection.query).toHaveBeenCalledWith(
        expect.objectContaining({
          nResults: 5,
          where: { websiteUrl: "https://example.com" },
        })
      );
    });

    it("returns an empty result when no chunks match", async () => {
      const emptyResult = {
        documents: [[]],
        metadatas: [[]],
      };

      collection.query.mockResolvedValue(emptyResult);

      const result = await retrieveChunks(
        [0.1, 0.2],
        "https://unknown.example"
      );

      expect(result).toEqual(emptyResult);
    });

    it("propagates database errors", async () => {
      collection.query.mockRejectedValue(
        new Error("ChromaDB unavailable")
      );

      await expect(
        retrieveChunks([0.1, 0.2], "https://example.com")
      ).rejects.toThrow("ChromaDB unavailable");
    });
  });

  describe("getVectorCount", () => {
    it("returns the collection vector count", async () => {
      const count = await getVectorCount();

      expect(count).toBe(5);
      expect(collection.count).toHaveBeenCalledOnce();
    });
  });
});