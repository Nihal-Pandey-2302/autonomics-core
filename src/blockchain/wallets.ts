import "dotenv/config";

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const AGENT_WALLETS: Record<string, { publicKey: string; secretKey: string }> = {
  "Consumer-1":   { publicKey: require_env("CONSUMER_1_PUBLIC"),   secretKey: require_env("CONSUMER_1_SECRET") },
  "Consumer-2":   { publicKey: require_env("CONSUMER_2_PUBLIC"),   secretKey: require_env("CONSUMER_2_SECRET") },
  "Consumer-3":   { publicKey: require_env("CONSUMER_3_PUBLIC"),   secretKey: require_env("CONSUMER_3_SECRET") },
  "Processor-1":  { publicKey: require_env("PROCESSOR_1_PUBLIC"),  secretKey: require_env("PROCESSOR_1_SECRET") },
  "Processor-2":  { publicKey: require_env("PROCESSOR_2_PUBLIC"),  secretKey: require_env("PROCESSOR_2_SECRET") },
  "Processor-3":  { publicKey: require_env("PROCESSOR_3_PUBLIC"),  secretKey: require_env("PROCESSOR_3_SECRET") },
  "DataSeller-1": { publicKey: require_env("DATASELLER_1_PUBLIC"), secretKey: require_env("DATASELLER_1_SECRET") },
  "DataSeller-2": { publicKey: require_env("DATASELLER_2_PUBLIC"), secretKey: require_env("DATASELLER_2_SECRET") },
};
