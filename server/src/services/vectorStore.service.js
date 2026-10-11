import { getWebCollection } from "../config/chroma.js";

export async function storeChunk({
    id,
    embedding,
    url,
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
                title,
            },
        ],
    });
}

export async function retrieveChunks(questionEmbedding, limit = 3) {
    const collection = await getWebCollection();

    return collection.query({
        queryEmbeddings: [questionEmbedding],
        nResults: limit,
        include: ["metadatas", "documents"],
    });
}

export async function getVectorCount() {
    const collection = await getWebCollection();

    return collection.count();
}