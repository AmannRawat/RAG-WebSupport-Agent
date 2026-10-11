import { scrapeReactWebsite } from "./scraper.service.js";
import { chunkText } from "./chunking.service.js";
import { generateVectorEmbedding } from "./embedding.service.js";
import { storeChunk, getVectorCount } from "./vectorStore.service.js";

function normalizeUrl(value) {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Only HTTP and HTTPS URLs are supported.");
    }

    url.hash = "";

    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.slice(0, -1);
    }

    return url.href;
}

export async function crawlWebsite(startUrl, options = {}) {
    const maxPages = options.maxPages ?? 20;
    const maxDepth = options.maxDepth ?? 2;

    const start = normalizeUrl(startUrl);
    const allowedOrigin = new URL(start).origin;

    const visited = new Set();
    let processedPages = 0;
    let indexedChunks = 0;
    let failedPages = 0;

    async function visitPage(pageUrl, depth) {
        const normalizedUrl = normalizeUrl(pageUrl);

        if (
            visited.has(normalizedUrl) ||
            visited.size >= maxPages ||
            depth > maxDepth
        ) {
            return;
        }

        // Restrict this crawl to the submitted website's origin.
        if (new URL(normalizedUrl).origin !== allowedOrigin) {
            return;
        }

        visited.add(normalizedUrl);

        try {
            console.log(`Crawling: ${normalizedUrl}`);

            const { head, body, internalLinks } =
                await scrapeReactWebsite(normalizedUrl);

            if (head.trim()) {
                const embedding = await generateVectorEmbedding(head);

                await storeChunk({
                    id: `${normalizedUrl}::head`,
                    embedding,
                    url: normalizedUrl,
                    text: head,
                    title: "",
                });
            }

            const chunks = chunkText(body);

            for (const [index, chunk] of chunks.entries()) {
                if (!chunk.trim()) continue;

                const embedding = await generateVectorEmbedding(chunk);

                await storeChunk({
                    id: `${normalizedUrl}::chunk-${index}`,
                    embedding,
                    url: normalizedUrl,
                    text: chunk,
                    title: "",
                });

                indexedChunks++;
            }

            processedPages++;

            for (const link of internalLinks) {
                if (visited.size >= maxPages) break;

                try {
                    const nextUrl = normalizeUrl(
                        new URL(link, normalizedUrl).href
                    );

                    if (new URL(nextUrl).origin === allowedOrigin) {
                        await visitPage(nextUrl, depth + 1);
                    }
                } catch {
                    // Ignore malformed links and continue the crawl.
                }
            }
        } catch (error) {
            failedPages++;
            console.error(
                `Failed to process ${normalizedUrl}: ${error.message}`
            );
        }
    }

    await visitPage(start, 0);

    const vectorCount = await getVectorCount();

    return {
        websiteUrl: start,
        discoveredPages: visited.size,
        processedPages,
        failedPages,
        indexedChunks,
        vectorCount,
        status:
            failedPages === 0
                ? "completed"
                : processedPages > 0
                    ? "partial"
                    : "failed",
    };
}