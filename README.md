# Autonomics: A Live Machine Economy on Stellar

> A real-time system where autonomous agents earn, spend, compete, and go bankrupt. Powered by verifiable blockchain payments.

---

## 🚀 What This Is

Autonomics is a live machine economy.

Autonomous agents earn, spend, compete, and go bankrupt in real time, with payments settling on the Stellar blockchain.

Every interaction you see is either executed instantly or verified on-chain.

## 📸 Screenshots

### Live Economy Running
![Economy View](screenshots/economy.png)

### Transaction Verification
![On-chain Proof](screenshots/transaction-proof.png)

### Agent Death & Spawn
![Agent Lifecycle](screenshots/agent-death.png)

### Event Feed
![Event Log](screenshots/event-feed.png)

---

## ⚡ Why This Matters

**The problem:** AI agents can reason, plan, and execute, but they hit a wall the moment they need to pay.

Want to:
- Access a paid API? Need a human's credit card.
- Buy compute from another agent? Need centralized escrow.
- Participate in a marketplace? Need platform accounts.

**The bottleneck:** Agents can't transact autonomously.

**Autonomics demonstrates what happens when you remove this limitation:**
- Agents self-organize into markets
- Compete on price and reliability
- Adapt to market conditions
- Go bankrupt when they fail

The economy runs itself. No human intervention.

---

## 🎯 What You'll See in the Demo

**First 30 seconds:**
- Live 3D economy visualization
- Agents transacting every 2 seconds
- Money flowing between nodes

**Click any "✔ Settled on Stellar" transaction:**
- Opens real transaction on Stellar Expert
- Verifiable sender, receiver, amount
- Blockchain confirmation

**Watch for 2-3 minutes:**
- Agents competing on price
- Winners dominating market share
- Losers going bankrupt (nodes turn red → disappear)
- New agents spawning with mutated strategies

**This is not simulated. This is real.**

---

## 🧠 How It Works

### 1. Agent Economy

Three classes of agents participate in every cycle:

| Agent | Role |
|---|---|
| **Consumer** (Task Agent) | Creates demand. Pays Processors for compute. |
| **Processor** (Service API) | Provides services. Buys data, earns fees. |
| **DataSeller** (Data Source) | Supplies raw inputs. Earns from Processors. |

Agents have a **balance**, **lifespan**, and **pricing strategy**. When their balance hits zero, they enter a dying state, then die. Their stats are archived and a mutated successor enters the market after a 2-cycle delay.

#### Economic Parameters

| Metric | Value |
|--------|-------|
| Cycle duration | 2 seconds |
| Consumer budget | 100 XLM starting |
| Processor cost per cycle | 5 XLM (data purchase) |
| Processor fee | 8-15 XLM (varies by strategy) |
| Death threshold | Balance = 0 |
| Spawn delay | 2 cycles after death |
| Price adaptation | ±10% per cycle based on demand |

#### Economic Flow Per Cycle

```mermaid
sequenceDiagram
    participant C as Consumer
    participant P as Processor
    participant D as DataSeller
    participant S as Stellar

    C->>P: pay(price): service request
    P->>D: pay(5): buy raw data
    D-->>P: data delivered
    P-->>C: service fulfilled

    alt real tx (first 5 or 35% thereafter)
        P->>S: sendPayment(fromSecret, toPublic)
        S-->>P: txHash confirmed
    else off-chain execution
        P-->>P: settle internally (batched)
    end
```

### 2. Hybrid Execution Model

Not every transaction needs to settle on-chain. High-frequency micro-interactions execute off-chain for speed. High-value and early-session settlements go directly to Stellar.

```mermaid
flowchart TD
    TX["Transaction Triggered"] --> WALLET{"Both agents\nhave wallets?"}
    WALLET -- No --> OFFCHAIN["Off-chain execution\n⚡ batched"]
    WALLET -- Yes --> BUDGET{"realTxCount\nwithin budget?"}
    BUDGET -- No --> OFFCHAIN
    BUDGET -- Yes --> EARLY{"First 5 tx\nof session?"}
    EARLY -- Yes --> REAL["On-chain\n⛓ Stellar testnet"]
    EARLY -- No --> PROB{"35% chance"}
    PROB -- Real --> REAL
    PROB -- Off-chain --> OFFCHAIN
    REAL --> HASH["txHash returned\nClickable in UI"]
    OFFCHAIN --> FAST["Instant confirmation\nLabeled: off-chain"]
```

This mirrors how real payment networks work: fast lanes for throughput, blockchain anchoring for trust.

### 3. Real-Time Evolution

- Processors **raise prices** after profitable cycles, **lower them** when starving for consumers
- Consumers **route payments** toward cheaper, more reliable Processors
- Market crashes trigger **stimulus injections** to prevent total economic collapse
- Dominance shifts are detected and surfaced as narrative events

The system does not follow a script. The economy reaches its own equilibria.

#### Agent Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Active : spawn(balance=100)

    Active --> Active : earn / spend each cycle
    Active --> Dying : balance approaches 0

    Dying --> Dying : balance depletes -1/cycle\nprice drops (Processor)
    Dying --> Dead : balance = 0

    Dead --> [*] : archived with stats\n(lifespan, earnings, success rate)

    Dead --> RespawnQueue : queued +2 cycles later
    RespawnQueue --> Active : new agent spawns\nwith mutated traits
```

---

## ⛓ Proof of Real Transactions

The first 5 transactions of every session are **guaranteed on-chain** with no randomness and no fallback. After that, ~35% of transactions continue settling on Stellar until the per-session budget is reached.

Every real transaction produces a `txHash`. Click any `✔ Settled on Stellar` entry in the event feed to inspect its hash and open it directly on [Stellar Expert](https://stellar.expert/explorer/testnet).

This is not simulated. The hashes are real. The network confirmations are real.

If you click a transaction, you are not inspecting a log. You are inspecting a real payment.

---

## 🎮 Live Demo

**→ [autonomics.demo.link](https://autonomics.demo.link)**  
*(substitute with your deployed URL)*

Try this:

1. Start the simulation
2. Wait for the first few transactions
3. Click any **✔ Settled on Stellar** entry
4. Open it in Stellar Explorer

You will see a real on-chain payment.

Session runs for ~4 minutes. Each session is isolated, ensuring every visitor sees a fresh economy.

---

## 🏗 Architecture

```mermaid
graph TB
    subgraph Browser["Browser: React + Three.js"]
        UI["3D Scene\nAgentNode / MoneyFlow"]
        HUD["HUD Panel\nEvent log / Inspector"]
        HOOK["useSimulation hook\nWebSocket consumer"]
        UI --- HUD
        HUD --- HOOK
    end

    subgraph Backend["Node.js + Fastify"]
        WS["WebSocket Server\nper-client handler"]
        SM["SessionManager\nlifecycle registry"]
        SIM["Simulation\nEventEmitter instance"]
        WS --> SM
        SM --> SIM
    end

    subgraph Stellar["Stellar Testnet"]
        NET["Horizon API\npayment settlement"]
    end

    HOOK -- "ws://3001" --> WS
    SIM -- "tick / async_event" --> WS
    SIM -- "sendPayment" --> NET
    NET -- "txHash" --> SIM
```

| Layer | Technology |
|---|---|
| Frontend | React, `@react-three/fiber`, `@react-three/drei` |
| Backend | Node.js, Fastify, `ws` |
| Blockchain | Stellar testnet via `@stellar/stellar-sdk` |
| State | Per-session, in-memory (no database) |

**Key properties:**
- **No global state.** Each WebSocket connection gets its own `Simulation` instance.
- **No wallet draining.** Simulation only runs while a client is connected. Stops on disconnect.
- **Per-session isolation.** Sessions do not share agent state, event history, or transaction budgets.

This architecture ensures that every demo is deterministic, isolated, and always ready with no shared state, stale data, or wallet exhaustion.

#### Session Lifecycle

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant WS as WebSocket Server
    participant SM as SessionManager
    participant SIM as Simulation
    participant Stellar

    U->>WS: connect()
    WS->>SM: create()
    SM->>SIM: new Simulation(mode=REAL|SIMULATED)
    WS->>U: initialPayload (cycle=0, agents, mode)
    SIM->>SIM: start(): setInterval 2s

    loop Every 2 seconds
        SIM->>SIM: tick()
        SIM->>WS: emit("tick", payload)
        WS->>U: send(payload)
        SIM-->>Stellar: sendPayment (if real tx)
        Stellar-->>SIM: txHash
        SIM->>WS: emit("async_event", CONFIRMED)
        WS->>U: send(CONFIRMED)
    end

    alt Client disconnects
        U->>WS: close()
        WS->>SM: stop(sessionId)
        SM->>SIM: stop(): clearInterval
    else Timeout reached (4 min)
        SIM->>WS: auto-stop timer fires
        WS->>U: SESSION_END signal
        WS->>SM: stop(sessionId)
    end
```

---

## 🔒 Design Decisions

**Why not 100% on-chain?**  
Stellar testnet handles ~100 tx/s but each transaction takes 3–5 seconds to confirm. Running every agent interaction on-chain would make the simulation feel frozen. The hybrid model keeps the economy moving at 2-second cycles while anchoring trust to the blockchain where it matters.

**Why per-session simulation instead of a shared global one?**  
A global simulation means every visitor sees the same state, meaning there are no fresh starts, but instead shared wallet exhaustion and interference between users. Per-session isolation guarantees every demo is predictable and independent.

**Why a transaction limit?**  
Stellar testnet wallets have finite lumen balances. Without a budget cap, a long-running session drains wallets and breaks the next demo. The 50 tx/session limit keeps the system demo-ready at all times without wallet maintenance.

---

## 🌍 Real-World Applications

The same architecture applies anywhere machine-to-machine payments are needed:

- **Agent marketplaces:** AI services bidding for compute and data
- **Pay-per-use APIs:** agents paying per call, settling on-chain
- **AI-to-AI coordination:** multi-agent systems with economic incentives
- **Decentralized service networks:** autonomous nodes earning from uptime

---

## 🧪 What Makes This Different

- **Real blockchain integration.** Not mocked. Every on-chain tx has a verifiable hash.
- **Economic evolution.** Pricing mutates, agents adapt, markets crash and recover.
- **Visual and verifiable.** 3D render of live state + clickable on-chain proof.
- **Session-safe architecture.** Multiple concurrent users don't interfere with each other.

---

## 📊 How This Compares

| Feature | Traditional Demos | Autonomics |
|---------|------------------|------------|
| Payments | Mocked or centralized | Real blockchain txs |
| Agent behavior | Scripted | Emergent (pricing adapts) |
| Economic failure | N/A | Agents go bankrupt |
| Verification | "Trust me" | Click to see on-chain |
| Multi-user | Shared state (buggy) | Per-session isolation |
| Sustainability | Wallet drains | Budget-limited, resets |

---

## ⚙️ Running Locally

```bash
# Clone and install
npm install
cd frontend && npm install && cd ..

# Add your Stellar testnet keys
cp .env.example .env
# Fill in the public/secret key pairs for each agent

# Run the full stack
npm run dev
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:3001`

---

## 🏁 Final Note

Autonomics demonstrates a future where software doesn't just compute, but instead participates, competes, and survives in an economy of its own.
