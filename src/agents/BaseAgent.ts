import type { Agent, AgentStatus } from "../models/types.js";
import { AgentType } from "../models/types.js";

export abstract class BaseAgent implements Agent {
  id: string;
  type: AgentType;
  balance: number;
  status: AgentStatus;

  // Evolution Metrics
  lifespan: number = 0;
  totalEarnings: number = 0;
  totalLosses: number = 0;
  successCount: number = 0;
  
  // Evolving Traits
  currentPrice: number = 10;
  riskTolerance: number = 0.5;

  // Track whether we've already emitted a DEATH log for this agent
  private _announcedDead = false;

  constructor(id: string, type: AgentType, initialBalance: number = 100) {
    this.id = id;
    this.type = type;
    this.balance = initialBalance;
    this.status = "active";
  }

  // Returns a [DEATH] string if this tick caused death, null otherwise
  updateState(): string | null {
    // Invariant: balance never drifts below zero
    if (this.balance < 0) this.balance = 0;

    if (this.balance <= 0) {
      this.status = "dead";
      if (!this._announcedDead) {
        this._announcedDead = true;
        return `[DEATH] ${this.id} removed from system`;
      }
      return null;
    }

    if (this.balance < 20) {
      this.status = "dying";
    } else {
      this.status = "active";
    }
    return null;
  }

  // Returns true only if the agent can afford and is alive
  pay(amount: number): boolean {
    if (this.status === "dead") return false;
    if (this.balance < amount) return false;
    this.balance -= amount;
    this.totalLosses += amount;
    const death = this.updateState();
    if (death) console.log(death);
    return true;
  }

  receive(amount: number) {
    if (this.status === "dead") return;
    
    // Soft cap on extreme wealth
    let actualGain = amount;
    if (this.balance > 400) {
      actualGain = amount * 0.25;
    } else if (this.balance > 250) {
      actualGain = amount * 0.5;
    }
    
    this.balance += actualGain;
    this.totalEarnings += actualGain;
    this.updateState();
  }
}
