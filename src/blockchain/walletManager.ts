import { AGENT_WALLETS } from "./wallets.js";

export const walletManager = {
  getPublicKey(agentId: string): string {
    const w = AGENT_WALLETS[agentId];
    if (!w) throw new Error(`No wallet for agent: ${agentId}`);
    return w.publicKey;
  },

  getSecretKey(agentId: string): string {
    const w = AGENT_WALLETS[agentId];
    if (!w) throw new Error(`No wallet for agent: ${agentId}`);
    return w.secretKey;
  },

  hasWallet(agentId: string): boolean {
    return !!AGENT_WALLETS[agentId];
  }
};
