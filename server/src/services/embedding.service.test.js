import { describe, it, expect, vi, beforeEach } from "vitest";

const { embedContent } = vi.hoisted(() => ({
  embedContent: vi.fn(),
}));

vi.mock("../config/gemini.js", () => ({
  ai: {
    models: {
      embedContent,
    },
  },
}));

import { generateVectorEmbedding } from "./embedding.service.js";

describe("embedding.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates an embedding for valid text", async () => {
    embedContent.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    });

    const result = await generateVectorEmbedding("Example content");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(embedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-2",
      contents: "Example content",
      encoding_format: "FLOAT",
    });
  });

  it.each(["", "   ", null, undefined])(
    "rejects empty input: %s",
    async (text) => {
      await expect(
        generateVectorEmbedding(text)
      ).rejects.toThrow(
        "Cannot generate an embedding for empty text."
      );

      expect(embedContent).not.toHaveBeenCalled();
    }
  );

  it("rejects a response without embedding values", async () => {
    embedContent.mockResolvedValue({
      embeddings: [{}],
    });

    await expect(
      generateVectorEmbedding("Example content")
    ).rejects.toThrow("Gemini returned an empty embedding.");
  });

  it("propagates Gemini errors", async () => {
    embedContent.mockRejectedValue(
      new Error("Gemini unavailable")
    );

    await expect(
      generateVectorEmbedding("Example content")
    ).rejects.toThrow("Gemini unavailable");
  });
});