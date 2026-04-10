import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Memo
} from "@stellar/stellar-sdk";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

// Small symbolic amount — avoids balance/rate issues
const TX_AMOUNT = "0.00001";

export interface PaymentParams {
  fromSecret: string;
  toPublic: string;
  memo?: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function _attempt(params: PaymentParams): Promise<PaymentResult> {
  try {
    const keypair = Keypair.fromSecret(params.fromSecret);
    const account = await server.loadAccount(keypair.publicKey());

    const builder = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET
    });

    builder.addOperation(
      Operation.payment({
        destination: params.toPublic,
        asset: Asset.native(),
        amount: TX_AMOUNT
      })
    );

    if (params.memo) {
      builder.addMemo(Memo.text(params.memo.slice(0, 28)));
    }

    builder.setTimeout(30);
    const tx = builder.build();
    tx.sign(keypair);

    const result = await server.submitTransaction(tx);
    return { success: true, txHash: result.hash };
  } catch (err: any) {
    const msg = err?.response?.data?.extras?.result_codes
      ? JSON.stringify(err.response.data.extras.result_codes)
      : (err?.message ?? "unknown");
    return { success: false, error: msg };
  }
}

export async function sendPayment(params: PaymentParams): Promise<PaymentResult> {
  const backoffs = [500, 1000];

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    const result = await _attempt(params);
    if (result.success) return result;

    if (attempt < backoffs.length) {
      await sleep(backoffs[attempt]);
    }
  }

  return { success: false, error: "Max retries exceeded" };
}
