import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { validatePublicHttpUrl } from "../security/urlSafety.js";

function extractLinks($) {
    const internalLinks = [];
    const externalLinks = [];

    $("a").each((_, element) => {
        const link = $(element).attr("href");

        if (
            !link ||
            link.startsWith("#") ||
            /^(mailto:|tel:|javascript:)/i.test(link)
        ) {
            return;
        }

        if (/^https?:\/\//i.test(link)) {
            externalLinks.push(link);
        } else {
            internalLinks.push(link);
        }
    });

    return { internalLinks, externalLinks };
}

export async function scrapeStaticWebsite(url) {
    const { data } = await axios.get(url, {
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
        headers: {
            "User-Agent": "WebsiteIntelligenceAssistant/1.0",
        },
    });

    const $ = cheerio.load(data);
    const head = $("head").html() || "";
    const body = $("body").text().replace(/\s+/g, " ").trim();

    return {
        head,
        body,
        ...extractLinks($),
    };
}


export async function scrapeReactWebsite(url) {
    // Validate the initial destination before launching the browser.
    await validatePublicHttpUrl(url);

    const browser = await puppeteer.launch({
        headless: true,
        args:
            process.env.PUPPETEER_NO_SANDBOX === "true"
                ? ["--no-sandbox", "--disable-setuid-sandbox"]
                : [],
    });

    try {
        const page = await browser.newPage();

        page.setDefaultNavigationTimeout(45000);

        // Intercept browser requests before they are sent.
        await page.setRequestInterception(true);

        page.on("request", async (request) => {
            try {
                const requestUrl = request.url();
                const protocol = new URL(requestUrl).protocol;

                // Permit non-network resources used by browser pages.
                if (
                    ["data:", "blob:", "about:"].includes(protocol)
                ) {
                    await request.continue();
                    return;
                }

                // Reject unsupported protocols and unsafe destinations.
                if (!["http:", "https:"].includes(protocol)) {
                    await request.abort("blockedbyclient");
                    return;
                }

                await validatePublicHttpUrl(requestUrl);
                await request.continue();
            } catch {
                // Fail closed: do not send requests that fail validation.
                try {
                    await request.abort("blockedbyclient");
                } catch {
                    // The request may already have been resolved.
                }
            }
        });

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
        });

        const html = await page.content();
        const $ = cheerio.load(html);

        const head = $("head").html() || "";

        const body = await page.evaluate(() =>
            document.body?.innerText.replace(/\s+/g, " ").trim() || ""
        );

        return {
            head,
            body,
            ...extractLinks($),
        };
    } finally {
        await browser.close();
    }
}