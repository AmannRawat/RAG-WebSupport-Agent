
import { createHash } from "node:crypto";
import { scrapeReactWebsite } from "./scraper.service.js";
import { chunkText } from "./chunking.service.js";
import { generateVectorEmbedding } from "./embedding.service.js";
import {
    storeChunk,
    getVectorCount,
    deleteChunks,
} from "./vectorStore.service.js";
import { validatePublicHttpUrl } from "../security/urlSafety.js";
import {
    getPageCheckpoint,
    savePageCheckpoint,
    getPageState,
    savePageState,
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

function hashPageContent(head, body) {
    return createHash("sha256")
        .update(head)
        .update("\0")
        .update(body)
        .digest("hex");
}

export async function crawlWebsite(startUrl, options = {}) {
    const maxPages = options.maxPages ?? 20;
    const maxDepth = options.maxDepth ?? 2;
    const jobId = options.jobId;
    const onProgress = options.onProgress;

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

    async function reportProgress() {
        if (!onProgress) return;

        await onProgress({
            processedPages,
            discoveredPages: visited.size,
            failedPages,
            maxPages,
        });
    }

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

        // Job-specific checkpoint: recover completed work on a retry.
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

            await reportProgress();

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
        const contentHash = hashPageContent(head, body);

        // Cross-job page state: determine whether content changed.
        const previousState = await getPageState(normalizedUrl);

        let pageIndexedChunks = 0;

        if (
            previousState?.contentHash === contentHash &&
            Array.isArray(previousState.chunkIds) &&
            Number.isInteger(previousState.indexedChunks)
        ) {
            // Reuse vectors for unchanged content.
            console.log(
                `[Crawler] Unchanged page; skipping embeddings: ${normalizedUrl}`
            );

            pageIndexedChunks = previousState.indexedChunks;
            indexedChunks += pageIndexedChunks;
        } else {
            const newChunkIds = [];

            // Index the page heading.
            if (head.trim()) {
                const id = `${normalizedUrl}::${contentHash}::head`; const embedding = await generateVectorEmbedding(head);

                await storeChunk({
                    id,
                    embedding,
                    url: normalizedUrl,
                    websiteUrl: allowedOrigin,
                    text: head,
                    title: "",
                });

                newChunkIds.push(id);
            }

            // Index the page body.
            const chunks = chunkText(body);

            for (const [index, chunk] of chunks.entries()) {
                if (!chunk.trim()) continue;
                const id = `${normalizedUrl}::${contentHash}::chunk-${index}`;
                const embedding = await generateVectorEmbedding(chunk);

                await storeChunk({
                    id,
                    embedding,
                    url: normalizedUrl,
                    websiteUrl: allowedOrigin,
                    text: chunk,
                    title: "",
                });

                newChunkIds.push(id);
                indexedChunks++;
                pageIndexedChunks++;
            }

            // Remove chunks from the previous version that no longer exist.
            const oldChunkIds = Array.isArray(previousState?.chunkIds)
                ? previousState.chunkIds
                : [];

            const newChunkIdSet = new Set(newChunkIds);
            const staleChunkIds = oldChunkIds.filter(
                (id) => !newChunkIdSet.has(id)
            );

            await deleteChunks(staleChunkIds);

            // Save state only after vector writes and stale-chunk deletion.
            await savePageState(normalizedUrl, {
                contentHash,
                chunkIds: newChunkIds,
                indexedChunks: pageIndexedChunks,
            });
        }

        // Save job recovery state after the page is successfully processed.
        await savePageCheckpoint(jobId, normalizedUrl, {
            indexedChunks: pageIndexedChunks,
            internalLinks,
        });

        processedPages++;
        await reportProgress();

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
                await visitPage(nextUrl, depth + 1);
            }
        }
    }

    await visitPage(start, 0);

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