/**
 * verify.ts — Verify trust claims in an A2A Agent Card
 *
 * This module implements the verification flow from SPEC.md Section 3.4.
 * It supports both "trust the presented data" (fast, uses verifiedAt staleness check)
 * and "live on-chain re-verification" modes.
 *
 * All on-chain reads use ethers v6 and require NO private key — view functions only.
 */

import { ethers } from 'ethers';
import {
  A2AAgentCard,
  VerifyOptions,
  VerifyResult,
  VaultfireTrustExtension,
  TrustTier,
  TIER_RANGES,
  CHAIN_CONFIGS,
  SupportedChain,
  scoreToTier,
  getChainConfig,
} from './types';

// ─── ABI Fragments ──────────────────────────────────────────────────────────

const IDENTITY_ABI = [
  'function isAgentActive(address agent) view returns (bool)',
  'function getAgent(address agent) view returns (string agentURI, bool active, string agentType, uint256 registeredAt)',
];

const PARTNERSHIP_ABI = [
  'function getBondsByParticipant(address participant) view returns (uint256[] bondIds)',
  'function getBond(uint256 bondId) view returns (tuple(uint256 bondId, address creator, address aiAgent, string partnershipType, uint256 bondValue, uint256 createdAt, bool active, uint256 expiresAt))',
  'function nextBondId() view returns (uint256)',
];

const ACCOUNTABILITY_ABI = [
  'function isAgentActive(address agent) view returns (bool)',
];

const REPUTATION_ABI = [
  'function getReputation(address agent) view returns (uint256 averageRating, uint256 totalFeedbacks, uint256 verifiedFeedbacks, uint256 lastUpdated)',
  'function getVerifiedFeedbackPercentage(address agent) view returns (uint256)',
];

// ─── Score Constants ─────────────────────────────────────────────────────────

const SCORE_IDENTITY_REGISTERED = 30;
const SCORE_HAS_BOND             = 25;
const SCORE_BOND_ACTIVE          = 15;
const SCORE_MULTIPLE_BONDS       = 5;

// Bond tier bonus tiers (by ETH value)
const BOND_TIER_THRESHOLDS = [
  { minEth: 1.0,  bonus: 20 },
  { minEth: 0.1,  bonus: 15 },
  { minEth: 0.01, bonus: 10 },
  { minEth: 0.001,bonus: 5  },
];

// ─── Canonical Registry Addresses ────────────────────────────────────────────

/** Known canonical Identity Registry addresses by chainId. */
export const CANONICAL_REGISTRY_ADDRESSES: Record<number, string> = {
  8453:  '0x35978DB675576598F0781dA2133E94cdCf4858bC', // Base
  43114: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3', // Avalanche
  42161: '0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1', // Arbitrum
  137:   '0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1', // Polygon
};

// ─── Internal Helpers ────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function tierMeetsMinimum(tier: TrustTier, minTier: TrustTier): boolean {
  const order: TrustTier[] = ['none', 'bronze', 'silver', 'gold', 'platinum'];
  return order.indexOf(tier) >= order.indexOf(minTier);
}

function isStale(verifiedAt: string, maxAgeSecs: number): boolean {
  if (maxAgeSecs === 0) return false;
  const verifiedMs = new Date(verifiedAt).getTime();
  const nowMs = Date.now();
  return (nowMs - verifiedMs) > maxAgeSecs * 1000;
}

function getRpcUrl(chain: SupportedChain, overrides?: Partial<Record<SupportedChain, string>>): string {
  return overrides?.[chain] ?? CHAIN_CONFIGS[chain].rpcUrl;
}

// ─── On-Chain Street Cred Computation ────────────────────────────────────────

export interface OnChainStreetCred {
  score: number;
  tier: TrustTier;
  breakdown: {
    identityRegistered: boolean;
    hasBond: boolean;
    bondActive: boolean;
    bondTierBonus: number;
    multipleBonds: boolean;
  };
  bonds: {
    partnership: { count: number; totalValue: string };
    accountability: { active: boolean };
  };
  reputation: {
    averageRating: number;
    totalFeedbacks: number;
    verifiedPercentage: number;
  };
}

/**
 * Compute the Street Cred score for an agent by reading live on-chain data.
 * This function requires NO private key — all reads are view calls.
 */
export async function computeStreetCred(
  agentAddress: string,
  chain: SupportedChain,
  rpcOverride?: string,
): Promise<OnChainStreetCred> {
  const config = CHAIN_CONFIGS[chain];
  const rpcUrl = rpcOverride ?? config.rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const identityRegistry = new ethers.Contract(config.identityRegistry, IDENTITY_ABI, provider);
  const partnershipBond  = new ethers.Contract(config.partnershipBond,   PARTNERSHIP_ABI, provider);
  const accountabilityBond = new ethers.Contract(config.accountabilityBond, ACCOUNTABILITY_ABI, provider);
  const reputation       = new ethers.Contract(config.reputation,         REPUTATION_ABI, provider);

  // ── Identity Check ─────────────────────────────────────────────────────────
  let identityRegistered = false;
  try {
    identityRegistered = await identityRegistry.isAgentActive(agentAddress);
  } catch {
    // Agent not registered
  }

  // ── Partnership Bond Check ─────────────────────────────────────────────────
  let partnerBondCount = 0;
  let totalBondValueWei = BigInt(0);
  let hasBond = false;
  let bondActive = false;
  let multipleBonds = false;

  try {
    const bondIds: bigint[] = await partnershipBond.getBondsByParticipant(agentAddress);
    let activeBondCount = 0;

    for (const bondId of bondIds) {
      try {
        const bond = await partnershipBond.getBond(bondId);
        if (bond.active) {
          activeBondCount++;
          totalBondValueWei += BigInt(bond.bondValue?.toString() ?? '0');
        }
      } catch {
        // Skip individual bond fetch failures
      }
    }

    partnerBondCount = activeBondCount;
    hasBond = activeBondCount > 0;
    bondActive = activeBondCount > 0;
    multipleBonds = activeBondCount > 1;
  } catch {
    // No bonds or contract not callable
  }

  // ── Accountability Bond Check ──────────────────────────────────────────────
  let accountabilityActive = false;
  try {
    accountabilityActive = await accountabilityBond.isAgentActive(agentAddress);
    if (accountabilityActive && !hasBond) {
      hasBond = true;
      bondActive = true;
    }
  } catch {
    // No accountability bond
  }

  // ── Bond Tier Bonus ────────────────────────────────────────────────────────
  const totalBondEth = parseFloat(ethers.formatEther(totalBondValueWei));
  let bondTierBonus = 0;
  for (const tier of BOND_TIER_THRESHOLDS) {
    if (totalBondEth >= tier.minEth) {
      bondTierBonus = tier.bonus;
      break;
    }
  }

  // ── Score Computation ──────────────────────────────────────────────────────
  let score = 0;
  if (identityRegistered) score += SCORE_IDENTITY_REGISTERED;
  if (hasBond)            score += SCORE_HAS_BOND;
  if (bondActive)         score += SCORE_BOND_ACTIVE;
  score += bondTierBonus;
  if (multipleBonds)      score += SCORE_MULTIPLE_BONDS;
  score = Math.min(95, score);

  // ── Reputation ─────────────────────────────────────────────────────────────
  let repData = { averageRating: 0, totalFeedbacks: 0, verifiedPercentage: 0 };
  try {
    const rep = await reputation.getReputation(agentAddress);
    const verifiedPct = await reputation.getVerifiedFeedbackPercentage(agentAddress);
    repData = {
      averageRating:      Number(rep.averageRating),
      totalFeedbacks:     Number(rep.totalFeedbacks),
      verifiedPercentage: Number(verifiedPct),
    };
  } catch {
    // No reputation data
  }

  return {
    score,
    tier: scoreToTier(score),
    breakdown: {
      identityRegistered,
      hasBond,
      bondActive,
      bondTierBonus,
      multipleBonds,
    },
    bonds: {
      partnership: {
        count:      partnerBondCount,
        totalValue: ethers.formatEther(totalBondValueWei),
      },
      accountability: {
        active: accountabilityActive,
      },
    },
    reputation: repData,
  };
}

// ─── Public Verify API ────────────────────────────────────────────────────────

/**
 * Verify the trust claims in an A2A Agent Card.
 *
 * By default, validates the presented trust data (schema, canonical addresses,
 * staleness) without making on-chain calls.
 *
 * Set `options.liveVerify = true` to perform a full on-chain re-verification.
 *
 * @param card   - An A2A Agent Card. May or may not have a `trust` field.
 * @param options - Verification options.
 * @returns VerifyResult describing the outcome.
 *
 * @example
 * const result = await verifyTrust(agentCard, { minScore: 31, maxAge: 3600 });
 * if (!result.verified) console.error(result.reason);
 */
export async function verifyTrust(
  card: A2AAgentCard,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const {
    minScore = 0,
    minTier,
    maxAge = 3600,
    liveVerify = false,
    rpcOverrides,
  } = options;

  const checkedAt = nowIso();

  // ── Step 1: Check trust field exists ──────────────────────────────────────
  if (!card.trust) {
    return {
      verified: false,
      reason:   'Agent Card has no trust field. Agent has not registered with Vaultfire.',
      checkedAt,
      source:   'presented',
    };
  }

  const trust: VaultfireTrustExtension = card.trust;

  // ── Step 2: Protocol check ─────────────────────────────────────────────────
  if (trust.protocol !== 'vaultfire') {
    return {
      verified: false,
      reason:   `Unknown trust protocol: '${trust.protocol}'. Only 'vaultfire' is supported.`,
      checkedAt,
      source:   'presented',
    };
  }

  if (trust.version !== '1.0') {
    return {
      verified: false,
      reason:   `Unsupported trust extension version: '${trust.version}'. Only '1.0' is supported.`,
      checkedAt,
      source:   'presented',
    };
  }

  // ── Step 3: Canonical registry address check ───────────────────────────────
  const canonicalAddr = CANONICAL_REGISTRY_ADDRESSES[trust.chainId];
  if (!canonicalAddr) {
    return {
      verified: false,
      reason:   `Unsupported chainId: ${trust.chainId}.`,
      checkedAt,
      source:   'presented',
    };
  }
  if (trust.registryAddress.toLowerCase() !== canonicalAddr.toLowerCase()) {
    return {
      verified: false,
      reason:   `registryAddress ${trust.registryAddress} does not match canonical address ${canonicalAddr} for chainId ${trust.chainId}. Possible fraud.`,
      checkedAt,
      source:   'presented',
    };
  }

  // ── Step 4: Staleness check ────────────────────────────────────────────────
  if (isStale(trust.verifiedAt, maxAge)) {
    // Stale data — must live-verify or fail
    if (!liveVerify) {
      return {
        verified: false,
        reason:   `Trust data is stale (verifiedAt: ${trust.verifiedAt}, maxAge: ${maxAge}s). Set liveVerify: true to re-verify.`,
        checkedAt,
        source:   'presented',
      };
    }
  }

  // ── Step 5: Live on-chain verification ────────────────────────────────────
  if (liveVerify) {
    const config = getChainConfig(trust.chainId);
    if (!config) {
      return {
        verified: false,
        reason:   `No chain config found for chainId ${trust.chainId}.`,
        checkedAt,
        source:   'live',
      };
    }

    let onChainData: OnChainStreetCred;
    try {
      onChainData = await computeStreetCred(
        trust.agentAddress,
        config.name,
        rpcOverrides?.[config.name],
      );
    } catch (err) {
      return {
        verified: false,
        reason:   `On-chain verification failed: ${err instanceof Error ? err.message : String(err)}`,
        checkedAt,
        source:   'live',
      };
    }

    if (!onChainData.breakdown.identityRegistered) {
      return {
        verified: false,
        reason:   `Agent ${trust.agentAddress} is not registered in the Identity Registry on ${config.name}.`,
        score:    0,
        tier:     'none',
        checkedAt,
        source:   'live',
      };
    }

    // Check score threshold
    const effectiveMinScore = minTier
      ? TIER_RANGES[minTier][0]
      : minScore;

    if (onChainData.score < effectiveMinScore) {
      return {
        verified: false,
        reason:   `Agent score ${onChainData.score} is below minimum required score ${effectiveMinScore} (tier: ${onChainData.tier}).`,
        score:    onChainData.score,
        tier:     onChainData.tier,
        checkedAt,
        source:   'live',
      };
    }

    if (minTier && !tierMeetsMinimum(onChainData.tier, minTier)) {
      return {
        verified: false,
        reason:   `Agent tier '${onChainData.tier}' does not meet required minimum tier '${minTier}'.`,
        score:    onChainData.score,
        tier:     onChainData.tier,
        checkedAt,
        source:   'live',
      };
    }

    return {
      verified:  true,
      score:     onChainData.score,
      tier:      onChainData.tier,
      checkedAt,
      source:    'live',
    };
  }

  // ── Step 6: Validate presented score/tier against thresholds ──────────────
  const presentedScore = trust.streetCred?.score ?? 0;
  const presentedTier  = trust.streetCred?.tier  ?? 'none';

  if (!trust.verified) {
    return {
      verified: false,
      reason:   'Agent Card trust.verified is false.',
      score:    presentedScore,
      tier:     presentedTier,
      checkedAt,
      source:   'presented',
    };
  }

  const effectiveMinScore = minTier ? TIER_RANGES[minTier][0] : minScore;
  if (presentedScore < effectiveMinScore) {
    return {
      verified: false,
      reason:   `Presented score ${presentedScore} is below required minimum ${effectiveMinScore}.`,
      score:    presentedScore,
      tier:     presentedTier,
      checkedAt,
      source:   'presented',
    };
  }

  if (minTier && !tierMeetsMinimum(presentedTier, minTier)) {
    return {
      verified: false,
      reason:   `Presented tier '${presentedTier}' does not meet required minimum tier '${minTier}'.`,
      score:    presentedScore,
      tier:     presentedTier,
      checkedAt,
      source:   'presented',
    };
  }

  return {
    verified:  true,
    score:     presentedScore,
    tier:      presentedTier,
    checkedAt,
    source:    'presented',
  };
}
