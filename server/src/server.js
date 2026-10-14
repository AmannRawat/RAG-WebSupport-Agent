
import "dotenv/config";
import app from "./app.js";
import { crawlQueue, redisConnection } from "./config/queue.js";

const PORT = Number(process.env.PORT) || 4000;

const server = app.listen(PORT, () => {
  console.log(`[API] Server running at http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`[API] Received ${signal}. Shutting down...`);

  server.close(async () => {
    try {
      await crawlQueue.close();
      await redisConnection.quit();
      console.log("[API] Shutdown complete.");
      process.exit(0);
    } catch (error) {
      console.error("[API] Shutdown error:", error);
      process.exit(1);
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
