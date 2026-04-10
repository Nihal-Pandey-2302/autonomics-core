export enum AgentType {
  DataSeller = "DataSeller",
  Processor = "Processor",
  Consumer = "Consumer"
}

export type AgentStatus = "active" | "dying" | "dead";

export interface Agent {
  id: string;
  type: AgentType;
  balance: number;
  status: AgentStatus;
}
