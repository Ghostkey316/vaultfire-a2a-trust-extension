# Submitting the A2A Trust Extension to the A2A Protocol

This document guides you through proposing the Vaultfire A2A Trust Extension to the Google A2A repository and the broader community.

---

## Where to Submit

### 1. GitHub Discussions (Primary — Preferred First Step)

**URL:** https://github.com/google/A2A/discussions

Start a discussion before opening a PR. The A2A team explicitly uses Discussions for protocol proposals and community feedback before formalizing changes.

**Category to use:** `Ideas` or `RFC`

This allows community feedback before you invest in a full PR. Once discussion reaches consensus, the PR becomes much easier to land.

### 2. GitHub Issues (For Tracking / Bug Reports)

**URL:** https://github.com/google/A2A/issues

Open an issue labeled `enhancement` or `proposal` as a companion to the Discussion thread. This helps with tracking and visibility in project boards.

### 3. Pull Request (After Discussion Consensus)

**URL:** https://github.com/google/A2A/pulls

After gathering feedback from the Discussion, open a PR against the `main` branch adding:
- A new file: `extensions/trust/README.md` or `docs/extensions/trust.md`
- A link to this repository from the A2A ecosystem docs

---

## How to Frame the Proposal

### Discussion / Issue Title

```
[Proposal] Add optional `trust` field to Agent Cards — on-chain trust verification via Vaultfire Protocol
```

### Opening Paragraph

Use this framing in the Discussion body:

> The A2A protocol solves agent _communication_ — how agents discover, describe, and talk to each other. It does not solve agent _trust_ — whether you should let an agent execute a task, access data, or enter a financial relationship.
>
> I'm proposing a minimal, non-breaking extension to Agent Cards that adds a `trust` field containing verifiable on-chain trust metadata. The extension is optional (backwards-compatible) and protocol-agnostic in design — the `protocol` field allows future trust systems beyond Vaultfire to be expressed in the same schema.

### Key Talking Points

Frame the proposal around these themes, in this order:

**1. The trust gap is real and urgent**

With 150+ organizations building on A2A, agent-to-agent interactions increasingly involve autonomous execution, financial transactions, and sensitive data access. Today there is no standard way to evaluate an agent's trustworthiness. This gap will become more critical as adoption grows.

**2. This extension is non-breaking**

The `trust` field is entirely optional. Existing Agent Cards are 100% valid without it. Agents that don't understand the field simply ignore it. There is zero backwards-compatibility risk.

**3. Economic bonds > reputation scores**

Reference the problem with centralized scores: they can be gamed, faked, or selectively applied. On-chain economic bonds require real capital commitment — an agent with a slashable accountability bond has genuine skin in the game. This is analogous to how proof-of-stake works in blockchain consensus.

**4. Multi-chain, open standard**

The extension covers Base, Avalanche, Arbitrum, and Polygon. The `protocol` field is extensible — other trust protocols can define their own values. This is designed to be a public standard, not a proprietary lock-in.

**5. Reference implementation is production-ready**

Point to this repository. Tests pass, TypeScript compiles, the demo runs with live on-chain data. This is not a paper proposal — it's a working implementation.

---

## Suggested Discussion Body Template

Copy, adapt, and post at https://github.com/google/A2A/discussions:

```markdown
## Summary

I'm proposing an optional `trust` field for A2A Agent Cards that adds verifiable
on-chain trust metadata from the Vaultfire Protocol.

## Problem

A2A solves communication, not trust. When an agent receives a request from another
agent claiming to be a "medical assistant" or "financial advisor," there is no standard
way to verify that claim or evaluate the requestor's trustworthiness. This matters
because:

- Agents increasingly execute high-value, irreversible actions autonomously
- Malicious agents can claim any capability in an Agent Card
- There is no standard way to express minimum trust requirements for an interaction

## Solution

Add an optional `trust` field to Agent Cards that expresses verifiable on-chain trust data:

```json
{
  "name": "MyAgent",
  "trust": {
    "protocol": "vaultfire",
    "version": "1.0",
    "chain": "base",
    "chainId": 8453,
    "registryAddress": "0x35978DB675576598F0781dA2133E94cdCf4858bC",
    "agentAddress": "0x...",
    "streetCred": {
      "score": 55,
      "maxScore": 95,
      "tier": "silver"
    },
    "bonds": {
      "accountability": { "active": true }
    },
    "verified": true,
    "verifiedAt": "2026-04-15T20:00:00Z"
  }
}
```

## Key Properties

- **Optional** — existing Agent Cards are unchanged
- **Verifiable** — any agent can independently verify the claims on-chain
- **Economic** — bonds require real capital; bad actors lose money, not just scores
- **Extensible** — the `protocol` field allows other trust systems to use the same shape
- **Multi-chain** — covers Base, Avalanche, Arbitrum, and Polygon

## Specification

Full RFC-style specification: https://github.com/Ghostkey316/vaultfire-a2a-trust-extension/blob/main/SPEC.md

JSON Schema: https://github.com/Ghostkey316/vaultfire-a2a-trust-extension/blob/main/schemas/a2a-trust-extension.json

## Reference Implementation

```
npm install @vaultfire/a2a
```

Source: https://github.com/Ghostkey316/vaultfire-a2a-trust-extension

## Questions for the Community

1. Is this the right location in the Agent Card for trust data (top-level `trust` field)?
2. Should the extension field be named `trust`, `x-trust`, or `vaultfire`?
3. Are there other trust protocols in A2A adopters that should be represented?
4. Would you use this if it were standardized?
```

---

## PR Checklist (When Ready to File a PR)

If the discussion is positive and you're ready to open a PR against the A2A repo:

- [ ] Fork https://github.com/google/A2A
- [ ] Create branch: `feature/trust-extension`
- [ ] Add `docs/extensions/trust.md` — link to this repo and SPEC.md
- [ ] Add `schemas/extensions/a2a-trust-extension.json` — copy of our schema
- [ ] Update `README.md` — link to the trust extension in a new "Extensions" section
- [ ] Reference the Discussion thread in the PR body
- [ ] Add "Closes #XXX" linking to the tracking issue
- [ ] Ensure all CI checks pass (markdown lint, link check)

---

## Additional Channels

After the GitHub Discussion, amplify in these channels:

| Channel | What to post |
|---|---|
| **A2A Discord / Slack** | Short post with discussion link |
| **X/Twitter** | "A2A has a trust gap. We filled it. @vaultfire A2A Trust Extension is live." |
| **LinkedIn** | Professional post — link to the spec and demo |
| **Hackernews** | Show HN: "A2A protocol trust extension with on-chain economic bonds" |
| **EthResearch** | Post in the "Mechanism Design" or "AI x Crypto" sections |
| **Linux Foundation A2A Working Group** | Email the maintainers directly |

---

## Contacts (A2A Maintainers)

Check the current MAINTAINERS file or CODEOWNERS in the repo for current contacts.
As of the spec writing date, the A2A project is hosted under:
https://github.com/google/A2A

Contributions are governed by the Google CLA — you'll need to sign it for any PR.

---

*Document maintained by Ghostkey316 / Vaultfire Protocol — ghostkey316@proton.me*
