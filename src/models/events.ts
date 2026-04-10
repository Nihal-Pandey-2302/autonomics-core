// ── Structured event types that flow through the system ──────────────────────

export type SimEventType =
  | "TX"
  | "FAIL"
  | "DEATH"
  | "SKIP_DUPLICATE"
  | "PENDING"
  | "CONFIRMED"
  | "CONSISTENCY_FAIL"
  | "DOMINANCE_SHIFT"
  | "MARKET_CRASH"
  | "NEW_ENTRANT"
  | "MARKET_STIMULUS";

export interface SimEvent {
  type: SimEventType;
  cycle: number;
  timestamp: number;
  // TX / PENDING / CONFIRMED
  from?:   string;
  to?:     string;
  amount?: number;
  txId?:   string;
  txHash?: string;
  // FAIL / DEATH / SKIP_DUPLICATE
  agentId?: string;
  message?: string;
  // Blockchain hybrid toggle
  simulated?: boolean;
}

export interface AgentSnapshot {
  id:      string;
  type:    string;
  balance: number;
  status:  string;
  // Evolution & stats
  lifespan:      number;
  totalEarnings: number;
  totalLosses:   number;
  successCount:  number;
  currentPrice:  number;
}

export interface TickPayload {
  cycle:        number;
  agents:       AgentSnapshot[];
  archive:      AgentSnapshot[];
  transactions: SimEvent[];
  events:       SimEvent[];
  // Session metadata
  sessionMode:  'REAL' | 'SIMULATED';
  sessionMs:    number;
  sessionLimit: number;
  realTxCount:  number;
  realTxLimit:  number;
}
