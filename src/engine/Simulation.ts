import { EventEmitter } from "events";
import { Consumer } from "../agents/Consumer.js";
import { Processor } from "../agents/Processor.js";
import { DataSeller } from "../agents/DataSeller.js";
import { BaseAgent } from "../agents/BaseAgent.js";
import { Random } from "../utils/random.js";
import { sendPayment } from "../blockchain/stellar.js";
import { walletManager } from "../blockchain/walletManager.js";
import { AgentType } from "../models/types.js";
import type { SimEvent, AgentSnapshot, TickPayload } from "../models/events.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeSnapshot(agents: BaseAgent[]): AgentSnapshot[] {
  return agents.map(a => ({
    id: a.id, type: a.type, balance: a.balance, status: a.status,
    lifespan: a.lifespan, totalEarnings: a.totalEarnings,
    totalLosses: a.totalLosses, successCount: a.successCount,
    currentPrice: a.currentPrice
  }));
}

function now() { return Date.now(); }

interface RespawnTask {
  cycle: number;
  type: AgentType;
  idSuffix: number;
}

export interface SimulationOptions {
  /** If false, ALL payments are simulated (no Stellar calls). */
  allowRealTx:  boolean;
  /** Budget of real Stellar tx before forced-simulated fallback. */
  realTxLimit:  number;
  /** Session max duration in ms. */
  sessionLimit: number;
  seed?:        number;
}

export class Simulation extends EventEmitter {
  // ── Agent pools ──────────────────────────────────────────────────────────
  private consumers:   Consumer[]   = [];
  private processors:  Processor[]  = [];
  private dataSellers: DataSeller[] = [];

  // ── State ────────────────────────────────────────────────────────────────
  private archive: AgentSnapshot[]  = [];
  private respawnQueue: RespawnTask[] = [];
  private idCounters = { Consumer: 3, Processor: 3, DataSeller: 2 };
  private topProcessorId: string | null = null;
  private processedTx = new Set<string>();
  private rng: Random;
  private cycleCount = 0;

  // ── Session tracking ─────────────────────────────────────────────────────
  private startedAt: number;
  private options: SimulationOptions;
  private realTxCount = 0;

  // ── Timers ───────────────────────────────────────────────────────────────
  private interval: NodeJS.Timeout | null = null;
  private pendingTimeouts: NodeJS.Timeout[] = [];
  private stopped = false;

  constructor(options: SimulationOptions) {
    super();
    this.options   = options;
    this.startedAt = Date.now();
    this.rng       = new Random(options.seed ?? Math.floor(Math.random() * 100000));

    for (let i = 1; i <= 2; i++) this.dataSellers.push(new DataSeller(`DataSeller-${i}`));
    for (let i = 1; i <= 3; i++) this.processors.push(new Processor(`Processor-${i}`));
    for (let i = 1; i <= 3; i++) this.consumers.push(new Consumer(`Consumer-${i}`));
  }

  private getAllAgents(): BaseAgent[] {
    return [...this.consumers, ...this.processors, ...this.dataSellers];
  }

  // ── Payment layer ─────────────────────────────────────────────────────────
  private firePayment(txId: string, fromId: string, toId: string, amount: number, cycle: number, forceSimulate: boolean) {
    if (this.stopped) return;
    if (!walletManager.hasWallet(fromId) || !walletManager.hasWallet(toId)) {
      // No wallet for respawned agents — always simulated
      forceSimulate = true;
    }

    // Force first 5 tx to be on-chain for instant trust signals.
    // After that use hybrid ~35% real, always respecting budget ceiling.
    const EARLY_GUARANTEE = 5;
    const withinBudget = this.realTxCount < this.options.realTxLimit;
    const useReal = !forceSimulate
      && this.options.allowRealTx
      && withinBudget
      && (this.realTxCount < EARLY_GUARANTEE || this.rng.chance(0.35));

    if (useReal) {
      this.realTxCount++;
      sendPayment({
        fromSecret: walletManager.getSecretKey(fromId),
        toPublic:   walletManager.getPublicKey(toId),
        memo:       txId.slice(0, 28)
      }).then(result => {
        if (this.stopped) return;
        if (result.success) {
          const ev: SimEvent = { type: "CONFIRMED", cycle, timestamp: now(), txId, txHash: result.txHash, from: fromId, to: toId, amount, simulated: false };
          console.log(`[CONFIRMED] ${txId} | tx: ${result.txHash!.slice(0, 12)}...`);
          this.emit("async_event", ev);
        } else {
          const ev: SimEvent = { type: "CONSISTENCY_FAIL", cycle, timestamp: now(), txId, message: result.error };
          this.emit("async_event", ev);
        }
      });
    } else {
      const t = this.pendingTimeouts;
      const handle = setTimeout(() => {
        if (this.stopped) return;
        const ev: SimEvent = { type: "CONFIRMED", cycle, timestamp: now(), txId, from: fromId, to: toId, amount, simulated: true };
        this.emit("async_event", ev);
        const idx = t.indexOf(handle);
        if (idx !== -1) t.splice(idx, 1);
      }, 150 + Math.random() * 250);
      t.push(handle);
    }
  }

  // ── Main tick ─────────────────────────────────────────────────────────────
  private tick() {
    if (this.stopped) return;

    this.cycleCount++;
    const cycle = this.cycleCount;
    const cycleEvents: SimEvent[] = [];
    const emit = (ev: SimEvent) => cycleEvents.push(ev);

    // ── Respawn (2-cycle delay) ─────────────────────────────────────────
    const pendingRespawns = this.respawnQueue.filter(r => r.cycle <= cycle);
    this.respawnQueue = this.respawnQueue.filter(r => r.cycle > cycle);

    for (const r of pendingRespawns) {
      if (r.type === AgentType.Consumer)   this.consumers.push(new Consumer(`Consumer-${r.idSuffix}`));
      if (r.type === AgentType.Processor)  { const a = new Processor(`Processor-${r.idSuffix}`); a.currentPrice = this.rng.intBetween(6, 11); this.processors.push(a); }
      if (r.type === AgentType.DataSeller) this.dataSellers.push(new DataSeller(`DataSeller-${r.idSuffix}`));
      emit({ type: "NEW_ENTRANT", cycle, timestamp: now(), message: `New ${r.type} entered the market` });
    }

    // ── Active pools ────────────────────────────────────────────────────
    const activeConsumers  = this.consumers.filter(c => c.status !== "dead" && !(c.status === "dying" && this.rng.chance(0.5)));
    const activeProcessors = this.processors.filter(p => p.status !== "dead" && !(p.status === "dying" && this.rng.chance(0.5)));
    const activeSellers    = this.dataSellers.filter(s => s.status !== "dead" && !(s.status === "dying" && this.rng.chance(0.5)));

    // Lifespan tick
    for (const a of this.getAllAgents()) if (a.status !== "dead") a.lifespan++;

    // ── Dominance tracking ──────────────────────────────────────────────
    if (activeProcessors.length > 0) {
      const best = activeProcessors.reduce((a, b) => a.balance > b.balance ? a : b);
      if (this.topProcessorId !== best.id && best.balance > 150) {
        if (this.topProcessorId) emit({ type: "DOMINANCE_SHIFT", cycle, timestamp: now(), message: `${best.id} overtook market leadership` });
        this.topProcessorId = best.id;
      }
    }

    // ── Chaos injection (every ~15 cycles) ─────────────────────────────
    if (cycle % 15 === 0 && activeConsumers.length > 0) {
      const lucky = this.rng.pick(activeConsumers)!;
      lucky.receive(50);
      emit({ type: "MARKET_STIMULUS", cycle, timestamp: now(), message: `Demand spike: ${lucky.id} received funding grant` });
    }

    // ── Core economic loop ──────────────────────────────────────────────
    for (const consumer of activeConsumers) {
      if (activeProcessors.length === 0 || activeSellers.length === 0) break;

      const processor = this.rng.weightedPick(activeProcessors, p => {
        const affordability = Math.max(1, 15 - p.currentPrice);
        const reliability   = Math.max(1, p.successCount);
        return affordability * reliability;
      })!;
      const seller = this.rng.pick(activeSellers)!;
      let profit = 0;

      const sellerTxId = `${cycle}-${processor.id}-${seller.id}-5`;
      if (this.processedTx.has(sellerTxId)) {
        emit({ type: "SKIP_DUPLICATE", cycle, timestamp: now(), txId: sellerTxId });
      } else if (processor.pay(5)) {
        this.processedTx.add(sellerTxId);
        seller.receive(5);
        profit -= 5;
        emit({ type: "TX", cycle, timestamp: now(), from: processor.id, to: seller.id, amount: 5, txId: sellerTxId });
        this.firePayment(sellerTxId, processor.id, seller.id, 5, cycle, false);

        if (this.rng.chance(0.2)) {
          emit({ type: "FAIL", cycle, timestamp: now(), agentId: processor.id, message: "Compute failure" });
          processor.currentPrice = Math.max(5, processor.currentPrice - 1);
        } else {
          processor.successCount++;
          const cost = processor.currentPrice;
          const consumerTxId = `${cycle}-${consumer.id}-${processor.id}-${cost}`;

          if (this.processedTx.has(consumerTxId)) {
            emit({ type: "SKIP_DUPLICATE", cycle, timestamp: now(), txId: consumerTxId });
          } else if (consumer.pay(cost)) {
            this.processedTx.add(consumerTxId);
            processor.receive(cost);
            profit += cost;
            emit({ type: "TX", cycle, timestamp: now(), from: consumer.id, to: processor.id, amount: cost, txId: consumerTxId });
            this.firePayment(consumerTxId, consumer.id, processor.id, cost, cycle, false);
            if (profit > 0 && this.rng.chance(0.3)) processor.currentPrice = Math.min(15, processor.currentPrice + 1);
          } else {
            emit({ type: "FAIL", cycle, timestamp: now(), agentId: consumer.id, message: `Cannot afford ${processor.id}` });
          }
        }
      } else {
        emit({ type: "FAIL", cycle, timestamp: now(), agentId: processor.id, message: `Cannot afford data` });
      }
    }

    // ── Decay & death ───────────────────────────────────────────────────
    let deathsThisCycle = 0;
    for (const agent of this.getAllAgents()) {
      if (agent.status === "dying") {
        agent.balance -= 1;
        if (agent.type === AgentType.Processor) agent.currentPrice = Math.max(5, agent.currentPrice - 2);
      }
      const death = agent.updateState();
      if (death) emit({ type: "DEATH", cycle, timestamp: now(), agentId: agent.id });

      if (agent.status === "dead") {
        deathsThisCycle++;
        const snap = makeSnapshot([agent])[0];
        this.archive.push(snap);
        if (this.archive.length > 100) this.archive.shift();

        if (agent.type === AgentType.Consumer)   this.consumers   = this.consumers.filter(a => a.id !== agent.id);
        if (agent.type === AgentType.Processor)  this.processors  = this.processors.filter(a => a.id !== agent.id);
        if (agent.type === AgentType.DataSeller) this.dataSellers = this.dataSellers.filter(a => a.id !== agent.id);

        this.idCounters[agent.type as keyof typeof this.idCounters]++;
        this.respawnQueue.push({
          cycle:     cycle + 2,
          type:      agent.type,
          idSuffix:  this.idCounters[agent.type as keyof typeof this.idCounters]
        });
      }
    }

    if (deathsThisCycle > 2) emit({ type: "MARKET_CRASH", cycle, timestamp: now(), message: `Market collapse! ${deathsThisCycle} agents died.` });

    // ── Publish ─────────────────────────────────────────────────────────
    const payload: TickPayload = {
      cycle,
      agents:       makeSnapshot(this.getAllAgents()),
      archive:      this.archive,
      transactions: cycleEvents.filter(e => e.type === "TX"),
      events:       cycleEvents,
      sessionMode:  this.options.allowRealTx ? "REAL" : "SIMULATED",
      sessionMs:    Date.now() - this.startedAt,
      sessionLimit: this.options.sessionLimit,
      realTxCount:  this.realTxCount,
      realTxLimit:  this.options.realTxLimit,
    };
    this.emit("tick", payload);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  start() {
    if (this.interval) return;
    console.log(`[SIM] Starting session (mode=${this.options.allowRealTx ? "REAL" : "SIMULATED"})`);
    this.interval = setInterval(() => this.tick(), 2000);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    for (const t of this.pendingTimeouts) clearTimeout(t);
    this.pendingTimeouts = [];
    console.log(`[SIM] Session stopped at cycle ${this.cycleCount} | realTx: ${this.realTxCount}`);
    this.emit("stopped", { cycles: this.cycleCount, realTxCount: this.realTxCount });
  }

  getInitialPayload(): TickPayload {
    return {
      cycle: 0,
      agents:       makeSnapshot(this.getAllAgents()),
      archive:      [],
      transactions: [],
      events:       [],
      sessionMode:  this.options.allowRealTx ? "REAL" : "SIMULATED",
      sessionMs:    0,
      sessionLimit: this.options.sessionLimit,
      realTxCount:  0,
      realTxLimit:  this.options.realTxLimit,
    };
  }
}
