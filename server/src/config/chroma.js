import { ChromaClient } from "chromadb";

export const chromaClient = new ChromaClient({
    host: process.env.CHROMA_HOST || "localhost",
    port: Number(process.env.CHROMA_PORT || 8000),
    ssl: false,
});

export const WEB_COLLECTION =
    process.env.CHROMA_COLLECTION || "WEB_SCRAPED_DATA_COLLECTION-1";

let collectionPromise;

export function getWebCollection() {
    if (!collectionPromise) {
        collectionPromise = (async () => {
            await chromaClient.heartbeat();

            return chromaClient.getOrCreateCollection({
                name: WEB_COLLECTION,
            });
        })();
    }

    return collectionPromise;
}