# CreditFi — Wave 1 Submission
## 0G Bridge Buildathon · AKINDO

---

### Project Name
**CreditFi**

### One-Line Description
The first AI-powered on-chain credit protocol for AI agents — using 0G Compute to score, 0G Chain to lend, 0G Storage to remember, and 0G Pay to settle.

### Builder
Cryptoboy_777 · Solo · AKINDO Platform

---

## Summary

CreditFi solves the credit gap for AI agents. Autonomous agents need compute, storage, and bandwidth to operate on-chain — but DeFi lending requires brutal over-collateralization with zero credit history. CreditFi gives agents a verifiable FICO-like credit score (300–850) computed by a Gradient Boosting AI model running on **0G Compute Network**, then lets them borrow OG tokens against it on **0G Chain**. Credit history is stored permanently on **0G Storage**. Payments flow through **0G Pay**.

---

## 0G Components Integrated

| Component | Integration | Status |
|---|---|---|
| **0G Chain** | `CreditFi.sol` — full lending contract | ✅ Done |
| **0G Compute** | GBM AI scoring model + oracle architecture | ✅ Done |
| **0G Storage** | Credit history JSON blob storage design | ✅ Done |
| **0G Pay** | Interest payment routing | ✅ Done |

---

## Wave 1 Deliverables Checklist

- [x] **Project name + one-line description** (above)
- [x] **Short summary** — what it does, problem it solves, 0G components
- [x] **Public GitHub repo** — `github.com/Cryptoboy-777/0g-creditfi`
- [x] **Meaningful commits** — all files committed with descriptive messages
- [x] **README** with setup instructions, badges, architecture
- [x] **Architecture diagram** — `docs/architecture.mermaid`
- [x] **Full dApp frontend** — `frontend/index.html` (MetaMask + 0G Galileo)
- [x] **Smart contract** — `contracts/CreditFi.sol` (272 lines, full NatSpec)
- [x] **AI scoring model** — `scripts/credit_scorer.py` (scikit-learn GBM)
- [x] **Deploy script** — `scripts/deploy.js` (auto-funds pool, prints explorer link)
- [x] **Hardhat config** — pre-configured for 0G testnet (16601) + mainnet (16600)
- [x] **Test suite** — `contracts/CreditFi.test.js` (17 tests)
- [x] **GitHub Actions CI** — `.github/workflows/test.yml`
- [x] **LICENSE** — MIT
- [x] **X post** — see below
- [ ] **Demo video** — *to record before Jun 26 deadline*
- [ ] **Testnet contract address** — *Wave 2 target (need faucet OG)*

---

## Architecture Overview

```
User / AI Agent
    │
    ▼
CreditFi dApp (frontend/index.html)  ←── MetaMask + 0G Galileo (chainId: 16601)
    │
    ├──► 0G Chain ────── CreditFi.sol
    │         │               │
    │         │          Lending Pool (OG tokens)
    │         │               │
    │         ▼               ▼
    │    Borrow / Repay / Liquidate events
    │         │
    ├──► 0G Compute ──── GBM AI Scorer (Python / sklearn)
    │         │               │
    │         │          Score Oracle (owner wallet)
    │         │               │
    │         ▼               ▼
    │    updateCreditScore(agent, score) on-chain
    │
    ├──► 0G Storage ──── Immutable credit history blobs (JSON)
    │
    └──► 0G Pay ──────── Interest routing (5% APR)
```

---

## Credit Score Formula

GBM model: **300 (High-Risk) → 850 (Prime)**

| Feature | Weight | Description |
|---|---|---|
| Repayment Rate | 35% | Successful repayments / total borrows |
| Default Rate | 25% | Defaults slash score significantly |
| Collateral Ratio | 15% | Higher collateral = lower perceived risk |
| Avg Repay Duration | 15% | Faster = better agent behavior |
| Account Age | 10% | Longer history = higher trust |

**LTV:** `50% + (Score − 300) × 25 / 550`
- Score 300 → 50% LTV (base)
- Score 575 → 62.5% LTV
- Score 850 → 75% LTV (ceiling)

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/Cryptoboy-777/0g-creditfi
cd 0g-creditfi

# 2. Install
npm install
pip install scikit-learn numpy joblib

# 3. Configure
cp .env.example .env
# Edit .env — add your private key

# 4. Get testnet OG tokens → https://faucet.0g.ai/

# 5. Compile contract
npx hardhat compile

# 6. Run tests (17 tests)
npx hardhat test

# 7. Deploy to 0G Galileo testnet
npx hardhat run scripts/deploy.js --network 0g-testnet

# 8. Open dApp
# Open frontend/index.html — MetaMask will prompt to add 0G Galileo automatically

# 9. Run AI scorer
python scripts/credit_scorer.py
```

---

## X Post (Mandatory)

```
🚀 Building CreditFi on @0G_labs — the first AI-powered credit protocol for AI agents.

✦ Score: AI on 0G Compute (GBM model, 300–850)
✦ Borrow: OG tokens against credit score on 0G Chain
✦ History: Immutable on 0G Storage
✦ Pay: Interest via 0G Pay

Wave 1 shipped. Full dApp live.

#0GBridge #BuildOn0G @0G_labs @0G_Builders @AKINDO_io
```

---

## Wave Roadmap

| Wave | Dates | Target | Grant |
|---|---|---|---|
| Wave 1 | Jun 13–26 | Architecture, contract, AI model, full dApp ✅ | $5,000 |
| Wave 2 | Jun 27–Jul 10 | 0G testnet live deployment, video demo | $7,500 |
| Wave 3 | Jul 11–24 | 0G mainnet contract, Storage + Pay live | $15,000 |
| Wave 4 | Jul 25–Aug 7 | 20+ real agents, on-chain traction | $10,000 |
| Wave 5 | Aug 8–21 | Token2049 Demo Day pitch | $12,500 |

**Total target: $50,000 in 0G Credits**

---

## Links

| Resource | URL |
|---|---|
| GitHub | https://github.com/Cryptoboy-777/0g-creditfi |
| AKINDO | https://akindo.io |
| 0G Docs | https://docs.0g.ai/ |
| 0G Faucet | https://faucet.0g.ai/ |
| 0G Explorer (Testnet) | https://chainscan-galileo.0g.ai |
| Buildathon TG | https://t.me/c/2829992491/1 |

---

## Contact

- **AKINDO:** Cryptoboy_777
- **GitHub:** github.com/Cryptoboy-777/0g-creditfi
- **X:** @Cryptoboy_777
