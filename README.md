# A2A Trust Extension — Vaultfire Protocol


> **⚠️ Alpha Software** — Vaultfire Protocol is live on mainnet and fully functional, but it is in **alpha**. Smart contracts have **not been formally audited** by a third-party security firm. This A2A Trust Extension is a proposal, not an adopted standard. It has not been reviewed or endorsed by the A2A protocol maintainers or the Linux Foundation. The specification, schemas, and reference implementation may change. See [LICENSE](./LICENSE) for warranty disclaimers.

**Formal specification and reference implementation for adding on-chain trust verification to Google A2A Agent Cards.**

[![Status: Draft](https://img.shields.io/badge/Status-Draft-yellow)](SPEC.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Chain: Base](https://img.shields.io/badge/Chain-Base-0052FF)](https://basescan.org)
[![Protocol: Vaultfire](https://img.shields.io/badge/Protocol-Vaultfire-orange)](https://theloopbreaker.com)

---

## The Problem

Google's A2A protocol (150+ organizations, Linux Foundation) solves agent *communication*. It does not solve agent *trust*.

An A2A Agent Card can currently assert anything:

```json
{
  "name": "Trustworthy Finance Bot",
  "description": "I manage institutional portfolios.",
  "capabilities": { "trade_execution": true }
}
```

Nothing in this card is verifiable. A malicious agent can claim any capability, any identity, any affiliation. Receiving agents have no standard way to evaluate whether to trust a peer.

**The A2A Trust Extension fills this gap.**

---

## The Solution

Add an optional `trust` field to Agent Cards — backed by real on-chain data from the Vaultfire Protocol. Any agent can independently verify the claims. No centralized trust authority required.

### Before (standard A2A Agent Card)

```json
{
  "name": "MyAgent",
  "description": "An AI assistant for financial analysis.",
  "url": "https://myagent.example.com",
  "capabilities": {
    "data_analysis": true,
    "report_generation": true
  }
}
```

### After (A2A Agent Card with Vaultfire Trust Extension)

```json
{
  "name": "MyAgent",
  "description": "An AI assistant for financial analysis.",
  "url": "https://myagent.example.com",
  "capabilities": {
    "data_analysis": true,
    "report_generation": true
  },
  "trust": {
    "protocol": "vaultfire",
    "version": "1.0",
    "chain": "base",
    "chainId": 8453,
    "registryAddress": "0x35978DB675576598F0781dA2133E94cdCf4858bC",
    "agentAddress": "0xA054f831B562e729F8D268291EBde1B2EDcFb84F",
    "streetCred": {
      "score": 55,
      "maxScore": 95,
      "tier": "silver",
      "breakdown": {
        "identityRegistered": true,
        "hasBond": true,
        "bondActive": true,
        "bondTierBonus": 0,
        "multipleBonds": false
      }
    },
    "bonds": {
      "partnership": { "count": 1, "totalValue": "0.01" },
      "accountability": { "active": true }
    },
    "reputation": {
      "averageRating": 85,
      "totalFeedbacks": 12,
      "verifiedPercentage": 75
    },
    "verified": true,
    "verifiedAt": "2026-04-15T20:00:00Z",
    "explorer": "https://basescan.org/address/0xA054f831B562e729F8D268291EBde1B2EDcFb84F"
  }
}
```

---

## Why This Works

### On-Chain = Independently Verifiable

Any agent can call `isAgentActive(agentAddress)` on the Vaultfire Identity Registry and verify the claim in milliseconds — without asking anyone's permission.

### Economic Bonds = Real Accountability

A reputation score without consequences is gameable. Vaultfire's accountability bonds require agents to post real ETH that can be slashed for misconduct. An agent with 0.1 ETH in an accountability bond has genuine skin in the game.

### Street Cred Score (0–95)

| Tier     | Score  | What It Means                                     |
|----------|--------|---------------------------------------------------|
| None     | 0      | Not registered                                    |
| Bronze   | 1–30   | Registered, minimal bonds                         |
| Silver   | 31–55  | Active bond present; basic accountability         |
| Gold     | 56–75  | Strong bond activity, growing reputation          |
| Platinum | 76–95  | Multiple bonds, high reputation, full engagement  |

### Multi-Chain From Day One

Base · Avalanche · Arbitrum · Polygon — all four chains supported. The `resolveMultiChain()` function checks all four in parallel and returns the best result.

### Non-Breaking Extension

The `trust` field is 100% optional. Existing Agent Cards are unchanged. Agents that don't implement this extension simply ignore the field.

---

## Installation

```bash
npm install @vaultfire/a2a
```

Or for local development with this reference implementation:

```bash
git clone https://github.com/Ghostkey316/vaultfire-a2a-trust-extension
cd vaultfire-a2a-trust-extension
npm install
```

---

## Usage

### Enrich Your Agent Card

Add live on-chain trust data to an Agent Card before broadcasting it. No private key required.

```typescript
import { enrichAgentCard } from '@vaultfire/a2a';

const myCard = {
  name: 'MyAgent',
  url: 'https://myagent.example.com',
  capabilities: { data_analysis: true },
};

const enriched = await enrichAgentCard(myCard, '0xYourAgentAddress', {
  chain: 'base', // or 'avalanche', 'arbitrum', 'polygon'
});

console.log(enriched.trust?.streetCred?.score); // e.g. 55
console.log(enriched.trust?.streetCred?.tier);  // e.g. 'silver'
```

### Verify an Incoming Agent Card

When you receive an Agent Card from a peer, verify its trust claims.

```typescript
import { verifyTrust } from '@vaultfire/a2a';

// Verify against presented data (fast — uses verifiedAt staleness check)
const result = await verifyTrust(agentCard, {
  minTier: 'silver', // require at least silver tier
  maxAge:  3600,     // reject data older than 1 hour
});

if (!result.verified) {
  throw new Error(`Rejecting agent: ${result.reason}`);
}

// Live on-chain verification (slower, authoritative)
const liveResult = await verifyTrust(agentCard, {
  minScore: 31,
  liveVerify: true, // actually calls the blockchain
});
```

### Multi-Chain Resolution

Check an agent's trust across all four supported chains.

```typescript
import { resolveMultiChain } from '@vaultfire/a2a';

const result = await resolveMultiChain('0xAgentAddress');

console.log(`Best chain: ${result.bestChain}`);
console.log(`Best score: ${result.bestScore}/95 (${result.bestTier})`);
console.log(`Found on any chain: ${result.foundOnAnyChain}`);

for (const chain of result.chains) {
  console.log(`  ${chain.chain}: ${chain.score}/95 (${chain.tier})`);
}
```

### Compute Street Cred Directly

```typescript
import { computeStreetCred } from '@vaultfire/a2a';

const cred = await computeStreetCred('0xAgentAddress', 'base');
console.log(cred.score);           // 0-95
console.log(cred.tier);            // 'none'|'bronze'|'silver'|'gold'|'platinum'
console.log(cred.breakdown);       // per-component breakdown
console.log(cred.bonds);           // partnership and accountability bond data
console.log(cred.reputation);      // average rating, feedback count
```

---

## Trust Thresholds (Recommended)

| Interaction Type                        | Minimum Tier | Minimum Score |
|-----------------------------------------|--------------|---------------|
| Discovery / metadata exchange           | None         | 0             |
| Read-only information queries           | Bronze       | 1             |
| Stateful collaboration                  | Silver       | 31            |
| Financial transactions (low value)      | Silver       | 40            |
| Financial transactions (high value)     | Gold         | 60            |
| Autonomous execution (irreversible)     | Platinum     | 76            |

---

## Scripts

```bash
# Run the demo (enriches a real Agent Card with live on-chain data)
npm run demo

# Run tests
npm test

# Type-check
npm run typecheck

# Build
npm run build
```

---

## Project Structure

```
vaultfire-a2a-trust-extension/
├── SPEC.md                          ← Formal specification (RFC/EIP style)
├── PR-READY.md                      ← How to propose this to the A2A repo
├── README.md                        ← This file
├── schemas/
│   └── a2a-trust-extension.json    ← JSON Schema for the trust field
├── src/
│   ├── types.ts                     ← TypeScript types and chain configs
│   ├── verify.ts                    ← Trust verification logic
│   ├── enrich.ts                    ← Agent Card enrichment
│   ├── resolve.ts                   ← Multi-chain resolution
│   └── index.ts                     ← Package exports
├── tests/
│   ├── verify.test.ts               ← Verification tests
│   └── enrich.test.ts               ← Enrichment tests
└── scripts/
    └── demo.ts                      ← Live on-chain demo
```

---

## Supported Chains

| Chain     | Chain ID | Identity Registry                            | Explorer                     |
|-----------|----------|----------------------------------------------|------------------------------|
| Base      | 8453     | `0x35978DB675576598F0781dA2133E94cdCf4858bC` | https://basescan.org         |
| Avalanche | 43114    | `0x57741F4116925341d8f7Eb3F381d98e07C73B4a3` | https://snowtrace.io         |
| Arbitrum  | 42161    | `0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1` | https://arbiscan.io          |
| Polygon   | 137      | `0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1` | https://polygonscan.com      |

---

## Vaultfire Ecosystem

| Package | Description |
|---|---|
| [`@vaultfire/agent-sdk`](https://github.com/Ghostkey316/vaultfire-sdk) | Core SDK — register agents, create bonds, query reputation |
| [`@vaultfire/langchain`](https://github.com/Ghostkey316/vaultfire-langchain) | LangChain / LangGraph integration |
| [`@vaultfire/a2a`](https://github.com/Ghostkey316/vaultfire-a2a) | Agent-to-Agent (A2A) protocol bridge |
| [`@vaultfire/enterprise`](https://github.com/Ghostkey316/vaultfire-enterprise) | Enterprise IAM bridge (Okta, Azure AD, OIDC) |
| [`@vaultfire/mcp-server`](https://github.com/Ghostkey316/vaultfire-mcp-server) | MCP server for Claude, Copilot, Cursor |
| [`@vaultfire/openai-agents`](https://github.com/Ghostkey316/vaultfire-openai-agents) | OpenAI Agents SDK integration |
| [`@vaultfire/vercel-ai`](https://github.com/Ghostkey316/vaultfire-vercel-ai) | Vercel AI SDK middleware and tools |
| [`@vaultfire/xmtp`](https://github.com/Ghostkey316/vaultfire-xmtp) | XMTP messaging with trust verification |
| [`@vaultfire/x402`](https://github.com/Ghostkey316/vaultfire-x402) | X402 payment protocol with trust gates |
| [`@vaultfire/vns`](https://github.com/Ghostkey316/vaultfire-vns) | Vaultfire Name Service — human-readable agent IDs |
| [`vaultfire-crewai`](https://github.com/Ghostkey316/vaultfire-crewai) | CrewAI integration (Python) |
| [`vaultfire-agents`](https://github.com/Ghostkey316/vaultfire-agents) | 3 reference agents with live on-chain trust |
| [`vaultfire-a2a-trust-extension`](https://github.com/Ghostkey316/vaultfire-a2a-trust-extension) | **This package** — A2A Trust Extension spec — on-chain trust for Agent Cards |
| [`vaultfire-showcase`](https://github.com/Ghostkey316/vaultfire-showcase) | Why Vaultfire Bonds beat trust scores — live proof |
| [`vaultfire-whitepaper`](https://github.com/Ghostkey316/vaultfire-whitepaper) | Trust Framework whitepaper — economic accountability for AI |
| [`vaultfire-docs`](https://github.com/Ghostkey316/vaultfire-docs) | Developer portal — quickstart, playground, framework picker |
---

## Specification

The formal specification for this extension is in [SPEC.md](SPEC.md). It covers:

- Abstract and motivation
- Full JSON schema definition
- Verification flow (6 steps)
- Trust thresholds for interaction types
- Multi-chain resolution algorithm
- Rationale (on-chain vs. centralized, why bonds matter)
- Security considerations
- Backwards compatibility

---

## Security

- **No private key required** — all operations are read-only view function calls
- **Canonical address allowlist** — prevents registry address spoofing
- **Staleness detection** — configurable `maxAge` rejects old claims
- **Live verification mode** — optional, authoritative on-chain re-verification
- **Never trust presented scores blindly** — always validate against canonical registry addresses

Report security issues to: ghostkey316@proton.me

---

## Contributing

Contributions welcome. See [PR-READY.md](PR-READY.md) for how to propose this extension to the A2A protocol GitHub repo.

---

## License

MIT — Ghostkey316 / Vaultfire Protocol

**Hub:** https://theloopbreaker.com  
**Email:** ghostkey316@proton.me  
**GitHub:** https://github.com/Ghostkey316/
