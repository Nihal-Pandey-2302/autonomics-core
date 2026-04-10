export type AgentStatus = 'active' | 'dying' | 'dead';

export type SimEventType =
  | 'TX' | 'FAIL' | 'DEATH' | 'SKIP_DUPLICATE'
  | 'PENDING' | 'CONFIRMED' | 'CONSISTENCY_FAIL'
  | 'DOMINANCE_SHIFT' | 'MARKET_CRASH' | 'NEW_ENTRANT' | 'MARKET_STIMULUS';

export interface AgentSnapshot {
  id: string;
  type: string;
  balance: number;
  status: AgentStatus;
  lifespan: number;
  totalEarnings: number;
  totalLosses: number;
  successCount: number;
  currentPrice: number;
}

export interface SimEvent {
  type: SimEventType;
  cycle: number;
  timestamp: number;
  from?: string;
  to?: string;
  amount?: number;
  txId?: string;
  txHash?: string;
  agentId?: string;
  message?: string;
  simulated?: boolean;
}

export interface TickPayload {
  cycle: number;
  agents: AgentSnapshot[];
  archive: AgentSnapshot[];
  transactions: SimEvent[];
  events: SimEvent[];
  sessionMode:  'REAL' | 'SIMULATED';
  sessionMs:    number;
  sessionLimit: number;
  realTxCount:  number;
  realTxLimit:  number;
}

export interface SessionEndMessage {
  type: 'SESSION_END';
  reason: 'timeout' | 'disconnect';
}
