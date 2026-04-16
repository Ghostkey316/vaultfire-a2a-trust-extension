# A2A Trust Extension: On-Chain Trust Verification for Agent Cards

| Field       | Value                                        |
|-------------|----------------------------------------------|
| **Title**   | A2A Trust Extension: On-Chain Trust Verification for Agent Cards |
| **Status**  | Draft                                        |
| **Author**  | Ghostkey316 (Vaultfire Protocol) <ghostkey316@proton.me> |
| **Created** | 2026-04-15                                   |
| **Version** | 1.0.0                                        |
| **License** | MIT                                          |

---

## Table of Contents

1. [Abstract](#abstract)
2. [Motivation](#motivation)
3. [Specification](#specification)
   - 3.1 [Extension Field Definition](#31-extension-field-definition)
   - 3.2 [JSON Schema](#32-json-schema)
   - 3.3 [Trust Score Tiers](#33-trust-score-tiers)
   - 3.4 [Verification Flow](#34-verification-flow)
   - 3.5 [Trust Thresholds for Interaction Types](#35-trust-thresholds-for-interaction-types)
   - 3.6 [Multi-Chain Resolution](#36-multi-chain-resolution)
4. [Rationale](#rationale)
5. [Reference Implementation](#reference-implementation)
6. [Security Considerations](#security-considerations)
7. [Backwards Compatibility](#backwards-compatibility)
8. [Appendix: Vaultfire Contract Addresses](#appendix-vaultfire-contract-addresses)

---

## Abstract

This document specifies an optional extension to the Google A2A (Agent-to-Agent) protocol's **Agent Card** format. The extension adds a `trust` field containing verifiable on-chain trust metadata sourced from the Vaultfire Protocol. It enables receiving agents to programmatically validate the trustworthiness of a peer agent before accepting requests, sharing resources, or entering economic relationships — without relying on any centralized trust authority.

The Vaultfire trust layer combines identity registration, economic accountability bonds, partnership bonds, and community reputation into a composite **Street Cred** score (0–95) anchored on Base, Avalanche, Arbitrum, and Polygon. This specification defines the data format, the verification procedure, trust thresholds, and multi-chain resolution logic for consuming agents.

---

## Motivation

### The Trust Gap in Agent-to-Agent Communication

The A2A protocol, now stewarded by the Linux Foundation and adopted by 150+ organizations, solves the _communication_ problem: how agents discover each other, what capabilities they advertise, and how they exchange messages. It does not solve the _trust_ problem: whether you should trust an agent that claims to be a "medical assistant" or a "financial advisor."

Today, an A2A agent card can assert anything:

```json
{
  "name": "Trustworthy Finance Bot",
  "description": "I manage institutional portfolios.",
  "capabilities": ["trade_execution", "portfolio_management"]
}
```

Nothing in this card is verifiable. A malicious agent can claim any capability, any identity, any professional affiliation. Receiving agents have no basis for trust decisions beyond the claims themselves.

### Why Existing Solutions Fall Short

| Approach | Problem |
|---|---|
| **Reputation databases (centralized)** | Single point of failure, corruptible, opaque |
| **OAuth / API keys** | Authenticates identity, not trustworthiness or behavior |
| **Whitelists / allowlists** | Doesn't scale; manual maintenance |
| **Verifiable Credentials (VCs)** | No economic stake; credentials can be issued without accountability |
| **Score-only systems** | No skin-in-the-game; scores without consequences |

What is needed is a trust layer with **economic consequences for bad behavior**, verifiable on a public ledger, that any agent can independently check in milliseconds.

### Vaultfire's Contribution

The Vaultfire Protocol provides exactly this:

1. **Identity Registration** — agents register on-chain; this is the trust root.
2. **Accountability Bonds** — agents post ETH/native tokens that can be slashed for misconduct.
3. **Partnership Bonds** — agents form mutual economic stakes; both parties have something to lose.
4. **Reputation System** — feedback from verified interactions is stored on-chain.
5. **Street Cred Score** — a composite 0–95 score derived entirely from on-chain data.
6. **Cross-Chain Coverage** — all four major chains, not just one.

This specification defines how this data maps onto the A2A Agent Card, creating an interoperability bridge between the A2A communication layer and the Vaultfire trust layer.

---

## Specification

### 3.1 Extension Field Definition

This extension adds a single top-level field `trust` to the A2A Agent Card JSON object.

The field **MUST** follow the schema defined in Section 3.2. All fields marked as required in the schema **MUST** be present when the `trust` field is included. The `trust` field itself is **OPTIONAL** — Agent Cards without it remain valid A2A documents and are backwards-compatible.

An agent presenting a `trust` field **MUST NOT** forge or modify on-chain data. The receiving agent **SHOULD** re-verify the claims against the blockchain using the `registryAddress` and `agentAddress` fields.

#### Canonical Position in Agent Card

```json
{
  "name": "...",
  "description": "...",
  "url": "...",
  "capabilities": { "...": true },
  "trust": {
    "protocol": "vaultfire",
    "version": "1.0",
    "chain": "base",
    "chainId": 8453,
    "registryAddress": "0x35978DB675576598F0781dA2133E94cdCf4858bC",
    "agentAddress": "0x...",
    "streetCred": { "..." },
    "bonds": { "..." },
    "reputation": { "..." },
    "verified": true,
    "verifiedAt": "2026-04-15T20:00:00Z",
    "explorer": "https://basescan.org/address/0x..."
  }
}
```

### 3.2 JSON Schema

The canonical JSON Schema is located at `schemas/a2a-trust-extension.json` in the reference implementation. Below is a normative inline representation:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Ghostkey316/vaultfire-a2a-trust-extension/blob/main/schemas/a2a-trust-extension.json",
  "title": "A2A Trust Extension — Vaultfire Protocol",
  "description": "Schema for the 'trust' field added to A2A Agent Cards",
  "type": "object",
  "required": ["protocol", "version", "chain", "chainId", "registryAddress", "agentAddress", "verified", "verifiedAt"],
  "properties": {
    "protocol": {
      "type": "string",
      "const": "vaultfire",
      "description": "Trust protocol identifier. MUST be 'vaultfire'."
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+$",
      "description": "Protocol version. This spec defines '1.0'."
    },
    "chain": {
      "type": "string",
      "enum": ["base", "avalanche", "arbitrum", "polygon"],
      "description": "Name of the canonical chain for this agent's primary trust record."
    },
    "chainId": {
      "type": "integer",
      "enum": [8453, 43114, 42161, 137],
      "description": "EIP-155 chain ID."
    },
    "registryAddress": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{40}$",
      "description": "Ethereum address of the Vaultfire Identity Registry on the specified chain."
    },
    "agentAddress": {
      "type": "string",
      "pattern": "^0x[0-9a-fA-F]{40}$",
      "description": "Ethereum address of this agent on the specified chain."
    },
    "streetCred": {
      "type": "object",
      "required": ["score", "maxScore", "tier"],
      "properties": {
        "score": { "type": "integer", "minimum": 0, "maximum": 95 },
        "maxScore": { "type": "integer", "const": 95 },
        "tier": { "type": "string", "enum": ["none", "bronze", "silver", "gold", "platinum"] },
        "breakdown": {
          "type": "object",
          "properties": {
            "identityRegistered": { "type": "boolean" },
            "hasBond": { "type": "boolean" },
            "bondActive": { "type": "boolean" },
            "bondTierBonus": { "type": "integer", "minimum": 0, "maximum": 20 },
            "multipleBonds": { "type": "boolean" }
          }
        }
      }
    },
    "bonds": {
      "type": "object",
      "properties": {
        "partnership": {
          "type": "object",
          "properties": {
            "count": { "type": "integer", "minimum": 0 },
            "totalValue": { "type": "string", "description": "ETH value as decimal string" }
          }
        },
        "accountability": {
          "type": "object",
          "properties": {
            "active": { "type": "boolean" }
          }
        }
      }
    },
    "reputation": {
      "type": "object",
      "properties": {
        "averageRating": { "type": "integer", "minimum": 0, "maximum": 100 },
        "totalFeedbacks": { "type": "integer", "minimum": 0 },
        "verifiedPercentage": { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "verified": {
      "type": "boolean",
      "description": "true if the agent passed baseline verification at verifiedAt."
    },
    "verifiedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of last verification."
    },
    "explorer": {
      "type": "string",
      "format": "uri",
      "description": "Block explorer URL for the agent address."
    }
  }
}
```

### 3.3 Trust Score Tiers

Street Cred scores map to named tiers as follows:

| Tier       | Score Range | Meaning                                           |
|------------|-------------|---------------------------------------------------|
| `none`     | 0           | Not registered or no trust data                  |
| `bronze`   | 1–30        | Registered; minimal or inactive bonds             |
| `silver`   | 31–55       | Active bond present; basic accountability         |
| `gold`     | 56–75       | Strong bond activity; growing reputation          |
| `platinum` | 76–95       | Multiple bonds, high reputation, full engagement  |

#### Score Breakdown

| Component           | Max Points | Condition                                    |
|---------------------|-----------|----------------------------------------------|
| Identity Registered | 30        | Agent address registered in Identity Registry |
| Has Bond            | 25        | At least one bond exists                     |
| Bond Active         | 15        | Bond is currently active (not expired)       |
| Bond Tier Bonus     | 20        | Higher bond value → more points              |
| Multiple Bonds      | 5         | More than one active bond                    |
| **Total**           | **95**    |                                              |

### 3.4 Verification Flow

When a receiving agent encounters an Agent Card with a `trust` field, it **SHOULD** perform the following verification steps:

#### Step 1: Schema Validation

Validate the `trust` field against the JSON Schema at `schemas/a2a-trust-extension.json`. Reject cards that fail schema validation.

#### Step 2: Protocol Check

Confirm `trust.protocol === "vaultfire"` and `trust.version === "1.0"`. Unknown protocols or versions **MAY** be treated as untrusted.

#### Step 3: Chain/Address Mapping

Look up the canonical registry address for the specified `chainId` in the Vaultfire contract registry (see Appendix). If `trust.registryAddress` does not match the known canonical address for `trust.chainId`, treat the card as fraudulent.

```
Known Registry Addresses:
  Base (8453):       0x35978DB675576598F0781dA2133E94cdCf4858bC
  Avalanche (43114): 0x57741F4116925341d8f7Eb3F381d98e07C73B4a3
  Arbitrum (42161):  0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1
  Polygon (137):     0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1
```

#### Step 4: On-Chain Verification

Call the Identity Registry's `isAgentActive(agentAddress)` function on the specified chain. If the call returns `false`, the agent is not actively registered and the `trust` field claims are invalid.

```typescript
// Pseudocode
const provider = new ethers.JsonRpcProvider(rpcUrl);
const registry = new ethers.Contract(registryAddress, IDENTITY_ABI, provider);
const isActive = await registry.isAgentActive(agentAddress);
if (!isActive) { /* reject or downgrade trust */ }
```

#### Step 5: Freshness Check

Check `trust.verifiedAt`. Claims older than a configurable staleness threshold (default: 1 hour) **SHOULD** trigger re-verification. Stale claims **MAY** be accepted at reduced trust, or re-verified in-band.

#### Step 6: Score Cross-Check (Optional)

For high-value interactions, receivers **MAY** independently compute the Street Cred score on-chain and compare it to the presented score. A discrepancy indicates tampering.

#### Step 7: Decision

Apply trust thresholds from Section 3.5 to decide whether to accept the request.

### 3.5 Trust Thresholds for Interaction Types

Implementors **SHOULD** adopt these thresholds unless their threat model requires adjustment:

| Interaction Type                        | Minimum Tier | Minimum Score | Notes                                    |
|-----------------------------------------|--------------|---------------|------------------------------------------|
| **Discovery / metadata exchange**       | None (any)   | 0             | Trust data informs but does not gate     |
| **Read-only information queries**       | Bronze       | 1             | Basic registration required              |
| **Stateful collaboration**              | Silver       | 31            | Active bond required                     |
| **Financial transactions (low value)**  | Silver       | 40            | Active bond + growing history            |
| **Financial transactions (high value)** | Gold         | 60            | Strong bonds, established reputation     |
| **Autonomous execution (irreversible)** | Platinum     | 76            | Maximum trust, multiple bonds, audit log |

These thresholds are informational. The consuming agent bears responsibility for setting appropriate thresholds for its threat model.

### 3.6 Multi-Chain Resolution

Some agents may be registered on multiple chains. This extension supports multi-chain resolution via the following algorithm:

#### Primary Chain Resolution

1. Read `trust.chain` and `trust.chainId` from the Agent Card.
2. Verify on that chain (see Section 3.4).
3. If verification fails, do not automatically fall back to other chains (this prevents downgrade attacks).

#### Cross-Chain Verification (Optional Enhancement)

When implementing the `resolve` function from the reference implementation, agents **MAY** check all four chains and return the highest valid trust score. This is useful for agents that registered on a different chain than the one presented.

```typescript
// Pseudocode
const results = await Promise.allSettled([
  verifyOnChain(agentAddress, CHAINS.base),
  verifyOnChain(agentAddress, CHAINS.avalanche),
  verifyOnChain(agentAddress, CHAINS.arbitrum),
  verifyOnChain(agentAddress, CHAINS.polygon),
]);

const valid = results
  .filter(r => r.status === 'fulfilled' && r.value.verified)
  .map(r => r.value);

const best = valid.sort((a, b) => b.streetCred.score - a.streetCred.score)[0];
```

#### Bridge Contract

Vaultfire deploys a Bridge contract on each chain that tracks cross-chain agent recognition. Calling `bridge.isAgentRecognized(agentAddress)` returns `true` if the agent is known on that chain regardless of where they originally registered.

| Chain     | Bridge Address                               |
|-----------|----------------------------------------------|
| Base      | 0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2   |
| Avalanche | 0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31   |
| Arbitrum  | 0xe2aDfe84703dd6B5e421c306861Af18F962fDA91   |
| Polygon   | 0xe2aDfe84703dd6B5e421c306861Af18F962fDA91   |

---

## Rationale

### Why On-Chain vs. Centralized?

Centralized trust registries require trusting the registry operator. If the operator is compromised, corrupted, or simply misconfigured, all agents in the ecosystem are affected. On-chain trust data has three key properties:

1. **Immutability**: Historical trust data cannot be retroactively altered.
2. **Transparency**: Any agent can independently verify the data without asking permission.
3. **Permissionlessness**: Any agent can register; no gatekeeper can arbitrarily exclude participants.

The tradeoff is cost (gas fees for registration and bond posting) and latency (block confirmation time). For agent-to-agent trust, these costs are one-time or infrequent, making on-chain the appropriate venue.

### Why Economic Bonds?

Reputation scores without economic consequences are gameable. An agent can accumulate a high score and then defect, losing only the score — which costs nothing. Economic bonds change this calculus:

- An agent with an active accountability bond has posted real economic value that can be slashed.
- A partnership bond represents mutual skin-in-the-game: both parties lose if either defects.
- The bond value scales with the trust level, creating a credible commitment mechanism.

This design is inspired by mechanism design theory (Myerson, 1979; Vickrey-Clarke-Groves) and the staking/slashing model pioneered in Ethereum proof-of-stake. Unlike credit scores (which merely record history), bonds create forward-looking incentive alignment.

### Why A2A Agent Cards?

A2A Agent Cards are the natural discovery and capability advertisement mechanism in the A2A ecosystem. Embedding trust data in the card ensures:

1. Trust is surfaced at the point of agent discovery, not as a separate lookup.
2. Agents that implement this extension can make trust decisions without additional round-trips.
3. The extension degrades gracefully — agents that don't understand the `trust` field simply ignore it.

### Why Vaultfire as the Trust Protocol?

This extension is authored by the Vaultfire Protocol team and uses Vaultfire contracts. The design is intentionally extensible: the `protocol` field in the schema allows future extensions to specify other trust protocols. This spec defines the `"vaultfire"` value; other protocols **MAY** be defined in separate specifications using the same `trust` field name and similar structure.

---

## Reference Implementation

The reference implementation for this specification is published as:

```
npm install @vaultfire/a2a
```

Source: https://github.com/Ghostkey316/vaultfire-a2a-trust-extension

### Key Functions

| Function              | Description                                                      |
|-----------------------|------------------------------------------------------------------|
| `verifyTrust()`       | Verify an Agent Card's trust claims against on-chain data        |
| `enrichAgentCard()`   | Add the `trust` field to an Agent Card using live on-chain data  |
| `resolveMultiChain()` | Check trust across all four supported chains                     |
| `computeStreetCred()` | Compute the Street Cred score from on-chain components           |

### Minimal Usage

```typescript
import { verifyTrust, enrichAgentCard } from '@vaultfire/a2a';

// Verify an incoming Agent Card
const result = await verifyTrust(agentCard, {
  minScore: 31,
  maxAge: 3600, // 1 hour staleness threshold
});

if (!result.verified) {
  throw new Error(`Trust verification failed: ${result.reason}`);
}

// Enrich your own Agent Card before broadcasting
const myCard = { name: 'MyAgent', url: 'https://myagent.example.com', ... };
const enriched = await enrichAgentCard(myCard, agentAddress, { chainId: 8453 });
```

---

## Security Considerations

### Replay Attacks

An agent may capture a valid, high-scoring Agent Card and reuse it. Mitigation:

- Receiving agents **MUST** check `verifiedAt` and reject stale claims (Section 3.4, Step 5).
- For high-value interactions, receiving agents **SHOULD** independently re-verify on-chain rather than trusting the presented data.
- Future versions of this spec may add request-bound nonces to the `trust` field.

### Score Inflation

An agent could temporarily create bonds to inflate their score, then withdraw. Mitigation:

- Bond duration and activity are reflected in the `bondActive` flag.
- The `verifiedAt` timestamp creates an audit trail.
- Slashing mechanisms in the Accountability Bond contract economically punish abandonment.

### Chain Impersonation

An agent could claim a `chainId` that doesn't match `registryAddress`, pointing to a malicious contract. Mitigation:

- Receiving agents **MUST** cross-reference `registryAddress` against known canonical addresses (Step 3 of verification flow).
- A hardcoded allowlist of canonical registry addresses is provided in the reference implementation.

### Private Key Security

The reference implementation is **read-only** and requires no private key. It only calls `eth_call` (view functions) on the blockchain. No signing, no transactions, no private key exposure.

### Sybil Attacks

An attacker could register many low-cost identities. Mitigation:

- Identity registration alone yields only 30/95 points (Bronze tier).
- Bonds require real ETH — each additional bonded identity costs money.
- The `multipleBonds` flag and partnership bonds require counterparty consent.

### Freshness vs. Availability

Requiring real-time on-chain verification adds latency and introduces RPC availability as a dependency. This spec does not mandate real-time verification — it allows for cached data with a staleness window — but implementors should design for RPC failures gracefully (e.g., treat RPC failure as "unverified" rather than "verified").

---

## Backwards Compatibility

This extension is **strictly additive**. Existing A2A Agent Cards without the `trust` field remain fully valid and fully compatible with the A2A protocol. No existing fields are modified or removed.

Agents that do not implement this extension **MUST** ignore the `trust` field if present. Per JSON object parsing rules (RFC 8259), additional fields must be ignored unless explicitly forbidden — the A2A spec does not forbid additional fields.

Implementors adding the `trust` field to existing agents can do so without breaking any existing consumers.

---

## Appendix: Vaultfire Contract Addresses

### Base (chainId: 8453) — Primary Hub

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| Identity Registry  | 0x35978DB675576598F0781dA2133E94cdCf4858bC   |
| Partnership Bond   | 0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4   |
| Accountability Bond| 0xf92baef9523BC264144F80F9c31D5c5C017c6Da8   |
| Reputation         | 0xdB54B8925664816187646174bdBb6Ac658A55a5F   |
| Bridge             | 0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2   |
| VNS                | 0x1437c4081233A4f0B6907dDf5374Ed610cBD6B25   |

### Avalanche (chainId: 43114)

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| Identity Registry  | 0x57741F4116925341d8f7Eb3F381d98e07C73B4a3   |
| Partnership Bond   | 0xea6B504827a746d781f867441364C7A732AA4b07   |
| Accountability Bond| 0xaeFEa985E0C52f92F73606657B9dA60db2798af3   |
| Reputation         | 0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24   |
| Bridge             | 0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31   |

### Arbitrum (chainId: 42161)

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| Identity Registry  | 0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1   |
| Partnership Bond   | 0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58   |
| Accountability Bond| 0xfDdd2B1597c87577543176AB7f49D587876563D2   |
| Reputation         | 0x8aceF0Bc7e07B2dE35E9069663953f41B5422218   |
| Bridge             | 0xe2aDfe84703dd6B5e421c306861Af18F962fDA91   |
| VNS                | 0x247F31bB2b5a0d28E68bf24865AA242965FF99cd   |

### Polygon (chainId: 137)

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| Identity Registry  | 0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1   |
| Partnership Bond   | 0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58   |
| Accountability Bond| 0xfDdd2B1597c87577543176AB7f49D587876563D2   |
| Reputation         | 0x8aceF0Bc7e07B2dE35E9069663953f41B5422218   |
| Bridge             | 0xe2aDfe84703dd6B5e421c306861Af18F962fDA91   |
| VNS                | 0x247F31bB2b5a0d28E68bf24865AA242965FF99cd   |

---

*This specification is maintained by the Vaultfire Protocol. Contributions welcome at https://github.com/Ghostkey316/vaultfire-a2a-trust-extension.*
