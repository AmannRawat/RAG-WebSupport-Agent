
import { createHash } from "node:crypto";
import {
  ensureCollection,
  qdrantClient,
  QDRANT_COLLECTION,
} from "../config/qdrant.js";

function toPointId(id) {
  // Qdrant point IDs must be unsigned integers or UUIDs.
  // Convert arbitrary existing chunk IDs into stable UUIDs.
  const hex = createHash("sha256")
    .update(String(id))
    .digest("hex")
    .slice(0, 32)
    .split("");

  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  const value = hex.join("");

  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join("-");
}

export async function storeChunk({
  id,
  embedding,
  url,
  websiteUrl,
  text,
  title = "",
}) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("A non-empty embedding is required.");
  }

  if (embedding.length !== Number(process.env.QDRANT_VECTOR_SIZE || 3072)) {
    throw new Error(
      `Embedding has ${embedding.length} dimensions, but QDRANT_VECTOR_SIZE ` +
      `is ${process.env.QDRANT_VECTOR_SIZE || 3072}.`
    );
  }

  await ensureCollection();

  await qdrantClient.upsert(QDRANT_COLLECTION, {
    wait: true,
    points: [
      {
        id: toPointId(id),
        vector: embedding,
        payload: {
          url,
          websiteUrl,
          title,
          text,
        },
      },
    ],
  });
}

export async function retrieveChunks(
  questionEmbedding,
  websiteUrl,
  limit = 3
) {
  await ensureCollection();

  const result = await qdrantClient.query(QDRANT_COLLECTION, {
    query: questionEmbedding,
    limit,
    filter: {
      must: [
        {
          key: "websiteUrl",
          match: { value: websiteUrl },
        },
      ],
    },
    with_payload: true,
    with_vector: false,
  });

  // Preserve the response shape expected by answer.service.js.
  const points = result.points || [];

  return {
    documents: [
      points.map((point) => point.payload?.text || ""),
    ],
    metadatas: [
      points.map((point) => ({
        url: point.payload?.url || "",
        websiteUrl: point.payload?.websiteUrl || "",
        title: point.payload?.title || "",
      })),
    ],
  };
}

export async function getVectorCount() {
  await ensureCollection();

  const result = await qdrantClient.count(QDRANT_COLLECTION, {
    exact: true,
  });

  return result.count;
}
