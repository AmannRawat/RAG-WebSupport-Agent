import { ai } from "../config/gemini.js";

const EMBEDDING_MODEL = "gemini-embedding-2";

export async function generateVectorEmbedding(text) {
    if (!text || !text.trim()) {
        throw new Error("Cannot generate an embedding for empty text.");
    }

    const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        encoding_format: "FLOAT",
    });

    const embedding = response.embeddings?.[0]?.values;

    if (!embedding?.length) {
        throw new Error("Gemini returned an empty embedding.");
    }

    return embedding;
}