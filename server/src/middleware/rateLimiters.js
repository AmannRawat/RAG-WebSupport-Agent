import rateLimit from "express-rate-limit";

export const crawlRateLimit = rateLimit({
  windowMs: 60 * 1000, //60 seconds
  limit: 5, //max requests allowed in 60 seconds
  standardHeaders: true,
  legacyHeaders: false,

  handler: (_req, res) => { //defines the response when the limit is exceeded.
    res.status(429).json({
      error: "Too many crawl requests. Please try again later.",
    });
  },
});

export const chatRateLimit = rateLimit({
  windowMs: 60 * 1000, //60 seconds
  limit: 20, //max requests allowed in 60 seconds
  standardHeaders: true,
  legacyHeaders: false,

  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many chat requests. Please try again later.",
    });
  },
});