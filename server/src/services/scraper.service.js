import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

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