import { BaseAgent } from "./BaseAgent";
import { AgentType } from "../models/types";

export class Processor extends BaseAgent {
  constructor(id: string, initialBalance: number = 100) {
    super(id, AgentType.Processor, initialBalance);
  }
}
