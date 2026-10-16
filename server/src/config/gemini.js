import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { Gemini } from "@posthog/ai/gemini";
import { PostHog } from "posthog-node";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from .env");
}

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const posthogEnabled =
  Boolean(process.env.POSTHOG_KEY) &&
  Boolean(process.env.POSTHOG_HOST);

export const monitoredAi = posthogEnabled
  ? new Gemini({
      apiKey: process.env.GEMINI_API_KEY,
      posthog: new PostHog(process.env.POSTHOG_KEY, {
        host: process.env.POSTHOG_HOST,
      }),
    })
  : null;