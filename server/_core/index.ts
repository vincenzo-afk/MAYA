import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerEmailAuthRoutes } from "./emailAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { serveStatic, setupVite } from "./vite";
import { createMessage } from "../db";
import { finalizeStreamedMayaReply, streamMayaReply } from "../mayaBrain";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerEmailAuthRoutes(app);
  app.post("/api/maya/stream", async (req, res) => {
    let finished = false;
    const send = (event: string, payload: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    res.on("close", () => { finished = true; });
    try {
      const user = await sdk.authenticateRequest(req);
      const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content || content.length > 4000) {
        res.status(400).json({ error: "Message content must be between 1 and 4,000 characters." });
        return;
      }
      res.status(200).set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      const userMessage = await createMessage({ userId: user.id, role: "user", kind: "text", content });
      send("user", userMessage);
      const reply = await streamMayaReply(user.id, { content, kind: "text" }, (delta) => {
        if (!finished) send("delta", { delta });
      });
      const mayaMessage = await finalizeStreamedMayaReply(user.id, content, reply);
      if (!finished) send("done", { mayaMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Maya could not reply just now.";
      if (res.headersSent) send("error", { message }); else res.status(500).json({ error: message });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
