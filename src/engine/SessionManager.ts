import { Simulation } from "./Simulation.js";
import type { SimulationOptions } from "./Simulation.js";

const SESSION_TIMEOUT_MS = 240_000; // 4 minutes
const REAL_TX_LIMIT      = 250; // Massively increased for hackathon presentation

export type SessionMode = "REAL" | "SIMULATED";

export interface SessionInfo {
  id:          string;
  mode:        SessionMode;
  simulation:  Simulation;
  startedAt:   number;
}

class SessionManager {
  private sessions = new Map<string, SessionInfo>();
  private realSessionId: string | null = null; // The one session with real tx
  private counter = 0;

  create(): SessionInfo {
    const id = `session-${Date.now()}-${++this.counter}`;

    // Only allow 1 active session to ensure no Stellar sequence collisions.
    // If a new connection arrives, we stop the old one (preventing ghost locks).
    if (this.realSessionId) {
      console.log(`[SESSION] Stealing REAL slot from old session: ${this.realSessionId}`);
      this.stop(this.realSessionId);
    }

    const allowRealTx = true;
    const mode: SessionMode = "REAL";

    const opts: SimulationOptions = {
      allowRealTx,
      realTxLimit:  REAL_TX_LIMIT,
      sessionLimit: SESSION_TIMEOUT_MS,
    };

    const simulation = new Simulation(opts);

    const info: SessionInfo = { id, mode, simulation, startedAt: Date.now() };
    this.sessions.set(id, info);

    if (allowRealTx) {
      this.realSessionId = id;
      console.log(`[SESSION] Created REAL session: ${id}`);
    } else {
      console.log(`[SESSION] Created SIMULATED session: ${id} (REAL slot taken)`);
    }

    return info;
  }

  stop(id: string) {
    const info = this.sessions.get(id);
    if (!info) return;

    info.simulation.stop();
    this.sessions.delete(id);

    if (this.realSessionId === id) {
      this.realSessionId = null;
      console.log(`[SESSION] REAL session freed: ${id}`);
    } else {
      console.log(`[SESSION] SIMULATED session ended: ${id}`);
    }
  }

  get(id: string): SessionInfo | undefined {
    return this.sessions.get(id);
  }

  count(): number {
    return this.sessions.size;
  }
}

export const sessionManager = new SessionManager();
