
import { getWebCollection } from "../config/chroma.js";

export async function storeChunk({
  id,
  embedding,
  url,
  websiteUrl,
  text,
  title = "",
}) {
  const collection = await getWebCollection();

  await collection.upsert({
    ids: [id],
    embeddings: [embedding],
    documents: [text],
    metadatas: [
      {
        url,
        websiteUrl,
        title,
      },
    ],
  });
}

export async function retrieveChunks(
  questionEmbedding,
  websiteUrl,
  limit = 3
) {
  const collection = await getWebCollection();

  return collection.query({
    queryEmbeddings: [questionEmbedding],
    nResults: limit,
    where: { websiteUrl },
    include: ["metadatas", "documents"],
  });
}

export async function getVectorCount() {
  const collection = await getWebCollection();
  return collection.count();
}
