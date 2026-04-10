import Fastify from "fastify";
import { attachWebSocket } from "./websocket.js";
import { sessionManager } from "../engine/SessionManager.js";

const PORT = Number(process.env.PORT ?? 3001);

export async function startServer() {
  const app = Fastify({ logger: false });

  // ── GET /sessions — active session count (useful for debugging) ──────────
  app.get("/sessions", async (_req, reply) => {
    reply.send({ active: sessionManager.count() });
  });

  // Start and attach WS
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[HTTP] Fastify listening on http://localhost:${PORT}`);
  attachWebSocket(app.server);
}
