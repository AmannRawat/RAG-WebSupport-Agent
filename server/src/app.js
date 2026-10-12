
import express from "express";
import cors from "cors";
import { answerQuestion } from "./services/answer.service.js";
import {
  enqueueCrawl,
  getCrawlJob,
} from "./services/crawlQueue.service.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as local CLI tools.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "10kb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "website-support-api" });
});

// Submit a website crawl
app.post("/api/crawls", async (req, res) => {
  try {
    const { url } = req.body ?? {};

    if (typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        error: "A website URL is required.",
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return res.status(400).json({
        error: "Please provide a valid URL.",
      });
    }

    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return res.status(400).json({
        error: "Please provide a valid HTTP or HTTPS website URL.",
      });
    }

    const job = await enqueueCrawl(parsedUrl.href);

    return res.status(202).json(job);
  } catch (error) {
    console.error("[API] Failed to enqueue crawl:", error);

    return res.status(500).json({
      error: "Unable to queue the website crawl.",
    });
  }
});

// Check crawl job status
app.get("/api/crawls/:jobId", async (req, res) => {
  try {
    const job = await getCrawlJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        error: "Crawl job not found.",
      });
    }

    return res.json(job);
  } catch (error) {
    console.error("[API] Failed to retrieve crawl job:", error);

    return res.status(500).json({
      error: "Unable to retrieve crawl job status.",
    });
  }
});

// Handle malformed JSON and other request errors
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      error: "Request body must contain valid JSON.",
    });
  }

  console.error("[API] Unexpected error:", error);

  return res.status(500).json({
    error: "Internal server error.",
  });
});


app.post("/api/chat", async (req, res) => {
  try {
    const { question, websiteUrl } = req.body ?? {};

    if (
      typeof question !== "string" ||
      !question.trim() ||
      typeof websiteUrl !== "string" ||
      !websiteUrl.trim()
    ) {
      return res.status(400).json({
        error: "Both question and websiteUrl are required.",
      });
    }

    const result = await answerQuestion(question, websiteUrl);

    return res.json(result);
  } catch (error) {
    console.error("[API] Chat failed:", error);

    return res.status(500).json({
      error: "Unable to answer the question right now.",
    });
  }
});

export default app;
