
import { scrapeReactWebsite } from "./scraper.service.js";
import { chunkText } from "./chunking.service.js";
import { generateVectorEmbedding } from "./embedding.service.js";
import { storeChunk, getVectorCount } from "./vectorStore.service.js";
import { validatePublicHttpUrl } from "../security/urlSafety.js";
import {
    getPageCheckpoint,
    savePageCheckpoint,
} from "./crawlCheckpoint.service.js";

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
    const jobId = options.jobId;

    if (!jobId) {
        throw new Error(
            "crawlWebsite requires a BullMQ jobId for checkpointing."
        );
    }

    const start = normalizeUrl(startUrl);
    const allowedOrigin = new URL(start).origin;
    const visited = new Set();

    let processedPages = 0;
    let indexedChunks = 0;
    let failedPages = 0;

    async function visitPage(pageUrl, depth) {
        let normalizedUrl;

        try {
            normalizedUrl = normalizeUrl(pageUrl);
        } catch (error) {
            failedPages++;
            console.warn(`[Crawler] Invalid URL skipped: ${error.message}`);
            return;
        }

        if (
            visited.has(normalizedUrl) ||
            visited.size >= maxPages ||
            depth > maxDepth
        ) {
            return;
        }

        if (new URL(normalizedUrl).origin !== allowedOrigin) {
            return;
        }

        // Validate the destination before scraping it.
        try {
            await validatePublicHttpUrl(normalizedUrl);
        } catch (error) {
            if (depth === 0) {
                throw new Error(
                    `Starting URL failed security validation: ${error.message}`
                );
            }

            failedPages++;
            console.warn(
                `[Crawler] Unsafe or unreachable URL skipped: ${normalizedUrl}`
            );
            return;
        }

        visited.add(normalizedUrl);

        // Checkpoint-store failures must propagate to BullMQ.
        const checkpoint = await getPageCheckpoint(jobId, normalizedUrl);

        if (
            checkpoint &&
            Array.isArray(checkpoint.internalLinks) &&
            Number.isInteger(checkpoint.indexedChunks)
        ) {
            console.log(
                `[Crawler] Resuming job ${jobId}: skipping ${normalizedUrl}`
            );

            processedPages++;
            indexedChunks += checkpoint.indexedChunks;

            for (const link of checkpoint.internalLinks) {
                if (visited.size >= maxPages) break;

                let nextUrl;

                try {
                    nextUrl = normalizeUrl(
                        new URL(link, normalizedUrl).href
                    );
                } catch {
                    continue;
                }

                if (new URL(nextUrl).origin === allowedOrigin) {
                    await visitPage(nextUrl, depth + 1);
                }
            }

            return;
        }

        console.log(`[Crawler] Crawling: ${normalizedUrl}`);

        // Website loading/scraping errors are page failures.
        let scraped;

        try {
            scraped = await scrapeReactWebsite(normalizedUrl);
        } catch (error) {
            failedPages++;

            console.error(
                `[Crawler] Failed to scrape ${normalizedUrl}: ${error.message}`
            );

            return;
        }

        const { head, body, internalLinks } = scraped;

        // Embedding, vector writes, and checkpoint writes are deliberately
        // outside the scraping catch. Their failures propagate to BullMQ.
        if (head.trim()) {
            const embedding = await generateVectorEmbedding(head);

            await storeChunk({
                id: `${normalizedUrl}::head`,
                embedding,
                url: normalizedUrl,
                websiteUrl: allowedOrigin,
                text: head,
                title: "",
            });
        }

        const chunks = chunkText(body);
        let pageIndexedChunks = 0;

        for (const [index, chunk] of chunks.entries()) {
            if (!chunk.trim()) continue;

            const embedding = await generateVectorEmbedding(chunk);

            await storeChunk({
                id: `${normalizedUrl}::chunk-${index}`,
                embedding,
                url: normalizedUrl,
                websiteUrl: allowedOrigin,
                text: chunk,
                title: "",
            });

            indexedChunks++;
            pageIndexedChunks++;
        }

        // Mark the page complete only after its vector writes succeed.
        await savePageCheckpoint(jobId, normalizedUrl, {
            indexedChunks: pageIndexedChunks,
            internalLinks,
        });

        processedPages++;

        for (const link of internalLinks) {
            if (visited.size >= maxPages) break;

            let nextUrl;

            try {
                nextUrl = normalizeUrl(
                    new URL(link, normalizedUrl).href
                );
            } catch {
                continue;
            }

            if (new URL(nextUrl).origin === allowedOrigin) {
                // Do not swallow child infrastructure errors.
                await visitPage(nextUrl, depth + 1);
            }
        }
    }

    await visitPage(start, 0);

    // A failure to query ChromaDB also propagates to BullMQ.
    const vectorCount = await getVectorCount();

    return {
        websiteUrl: start,
        jobId,
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