import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { sessionManager } from "../engine/SessionManager.js";
import type { TickPayload } from "../models/events.js";

const SESSION_TIMEOUT_MS = 240_000; // must match SessionManager

export function attachWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    // ── Create a dedicated simulation session for this client ────────────
    const session = sessionManager.create();
    const { simulation } = session;

    console.log(`[WS] Client connected → ${session.id} (${session.mode})`);

    // ── Send initial state immediately ───────────────────────────────────
    ws.send(JSON.stringify(simulation.getInitialPayload()));

    // ── Wire up simulation events → this socket only ─────────────────────
    const onTick = (payload: TickPayload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload), err => {
          if (err) console.error(`[WS] Send error: ${err.message}`);
        });
      }
    };

    const onAsyncEvent = (ev: unknown) => {
      // Re-broadcast CONFIRMED/FAIL events as mini tick frames
      if (ws.readyState !== WebSocket.OPEN) return;
      
      const payloadObj = (simulation as any); // Access realTxCount safely

      const mini = {
        events:      [ev],
        sessionMode: session.mode,
        sessionMs:   Date.now() - session.startedAt,
        sessionLimit: SESSION_TIMEOUT_MS,
        realTxCount: payloadObj.realTxCount ?? 0,
        realTxLimit: payloadObj.options?.realTxLimit ?? 250,
      };
      ws.send(JSON.stringify(mini), () => {});
    };

    simulation.on("tick", onTick);
    simulation.on("async_event", onAsyncEvent);

    // ── Auto-stop after timeout ───────────────────────────────────────────
    const autoStopTimer = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send a special "SESSION_END" event before closing
        const endMsg = JSON.stringify({ type: "SESSION_END", reason: "timeout" });
        ws.send(endMsg, () => ws.close(1000, "Session expired"));
      }
      sessionManager.stop(session.id);
    }, SESSION_TIMEOUT_MS);

    // ── Start simulation ONLY now (on connect) ────────────────────────────
    simulation.start();

    // ── Cleanup on disconnect ─────────────────────────────────────────────
    ws.on("close", () => {
      clearTimeout(autoStopTimer);
      simulation.off("tick", onTick);
      simulation.off("async_event", onAsyncEvent);
      sessionManager.stop(session.id);
      console.log(`[WS] Client disconnected → ${session.id}`);
    });

    ws.on("error", (err) => {
      console.error(`[WS] Error on ${session.id}: ${err.message}`);
      ws.close();
    });
  });

  console.log("[WS] WebSocket server attached (per-session mode)");
}
