import "dotenv/config";
import { startServer } from "./server/server.js";

async function bootstrap() {
  await startServer();
  // Simulations are started per-session on WS connect — nothing to launch here.
  console.log("🚀 Autonomics — awaiting connections (session-per-client mode)");
}

bootstrap();
