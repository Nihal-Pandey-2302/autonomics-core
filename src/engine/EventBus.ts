import { EventEmitter } from "events";
import type { SimEvent, AgentSnapshot, TickPayload } from "../models/events.js";

// ── In-memory circular buffer for last N transactions ─────────────────────────
const MAX_TRANSACTIONS = 100;

class EventBus extends EventEmitter {
  // Rolling buffer — newest at the end
  private _transactions: SimEvent[] = [];

  // Most recent agent snapshot (set at end of each tick)
  private _agentState: AgentSnapshot[] = [];
  private _archiveState: AgentSnapshot[] = [];

  // Stats counters
  totalVolume   = 0;
  totalDeaths   = 0;

  // ── Called by Simulation at end of every tick ──────────────────────────────
  publish(payload: TickPayload) {
    // Merge tick transactions into buffer
    for (const ev of payload.events) {
      if (ev.type === "TX" || ev.type === "CONFIRMED") {
        this._transactions.push(ev);
        if (ev.type === "TX" && ev.amount) this.totalVolume += ev.amount;
      }
      if (ev.type === "DEATH") this.totalDeaths++;
    }

    // Trim buffer
    if (this._transactions.length > MAX_TRANSACTIONS) {
      this._transactions = this._transactions.slice(-MAX_TRANSACTIONS);
    }

    this._agentState = payload.agents;
    this._archiveState = payload.archive;

    // Notify WebSocket layer
    this.emit("tick", payload);
  }

  // ── Push a single async event (e.g. CONFIRMED from stellar) ──────────────
  pushAsyncEvent(ev: SimEvent) {
    if (ev.type === "CONFIRMED" || ev.type === "CONSISTENCY_FAIL") {
      this._transactions.push(ev);
      if (this._transactions.length > MAX_TRANSACTIONS) {
        this._transactions = this._transactions.slice(-MAX_TRANSACTIONS);
      }
    }
    this.emit("async_event", ev);
  }

  getAgents(): AgentSnapshot[]  { return this._agentState; }
  getArchive(): AgentSnapshot[] { return this._archiveState; }
  getTransactions(): SimEvent[] { return [...this._transactions]; }

  getStats() {
    const total  = this._agentState.length;
    const active = this._agentState.filter(a => a.status === "active").length;
    const dying  = this._agentState.filter(a => a.status === "dying").length;
    const dead   = this._agentState.filter(a => a.status === "dead").length;
    return { total, active, dying, dead, totalVolume: this.totalVolume, totalDeaths: this.totalDeaths };
  }
}

// Singleton — shared by Simulation, WS, and HTTP
export const eventBus = new EventBus();
