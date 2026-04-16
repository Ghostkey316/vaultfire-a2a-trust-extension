/**
 * TypeScript types for the A2A Trust Extension — Vaultfire Protocol
 *
 * These types match the JSON Schema defined in schemas/a2a-trust-extension.json
 * and the specification in SPEC.md.
 *
 * @see https://github.com/Ghostkey316/vaultfire-a2a-trust-extension
 */

// ─── Trust Tiers ────────────────────────────────────────────────────────────

/** Named trust tier derived from the Street Cred score. */
export type TrustTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

/** Street Cred score ranges for each tier. */
export const TIER_RANGES: Record<TrustTier, [number, number]> = {
  none:     [0,  0],
  bronze:   [1,  30],
  silver:   [31, 55],
  gold:     [56, 75],
  platinum: [76, 95],
};

/** Derive a TrustTier from a numeric score. */
export function scoreToTier(score: number): TrustTier {
  if (score <= 0)  return 'none';
  if (score <= 30) return 'bronze';
  if (score <= 55) return 'silver';
  if (score <= 75) return 'gold';
  return 'platinum';
}

// ─── Supported Chains ───────────────────────────────────────────────────────

/** Supported chain names in the Vaultfire ecosystem. */
export type SupportedChain = 'base' | 'avalanche' | 'arbitrum' | 'polygon';

/** Supported chain IDs. */
export type SupportedChainId = 8453 | 43114 | 42161 | 137;

/** Chain configuration record. */
export interface ChainConfig {
  name: SupportedChain;
  chainId: SupportedChainId;
  rpcUrl: string;
  identityRegistry: string;
  partnershipBond: string;
  accountabilityBond: string;
  reputation: string;
  bridge: string;
  vns?: string;
  explorerUrl: string;
}

/** All Vaultfire-supported chain configurations. */
export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  base: {
    name: 'base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    identityRegistry:    '0x35978DB675576598F0781dA2133E94cdCf4858bC',
    partnershipBond:     '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4',
    accountabilityBond:  '0xf92baef9523BC264144F80F9c31D5c5C017c6Da8',
    reputation:          '0xdB54B8925664816187646174bdBb6Ac658A55a5F',
    bridge:              '0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2',
    vns:                 '0x1437c4081233A4f0B6907dDf5374Ed610cBD6B25',
    explorerUrl:         'https://basescan.org',
  },
  avalanche: {
    name: 'avalanche',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    identityRegistry:    '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3',
    partnershipBond:     '0xea6B504827a746d781f867441364C7A732AA4b07',
    accountabilityBond:  '0xaeFEa985E0C52f92F73606657B9dA60db2798af3',
    reputation:          '0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24',
    bridge:              '0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31',
    explorerUrl:         'https://snowtrace.io',
  },
  arbitrum: {
    name: 'arbitrum',
    chainId: 42161,
    rpcUrl: 'https://arbitrum-one.publicnode.com',
    identityRegistry:    '0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1',
    partnershipBond:     '0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58',
    accountabilityBond:  '0xfDdd2B1597c87577543176AB7f49D587876563D2',
    reputation:          '0x8aceF0Bc7e07B2dE35E9069663953f41B5422218',
    bridge:              '0xe2aDfe84703dd6B5e421c306861Af18F962fDA91',
    vns:                 '0x247F31bB2b5a0d28E68bf24865AA242965FF99cd',
    explorerUrl:         'https://arbiscan.io',
  },
  polygon: {
    name: 'polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    identityRegistry:    '0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1',
    partnershipBond:     '0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58',
    accountabilityBond:  '0xfDdd2B1597c87577543176AB7f49D587876563D2',
    reputation:          '0x8aceF0Bc7e07B2dE35E9069663953f41B5422218',
    bridge:              '0xe2aDfe84703dd6B5e421c306861Af18F962fDA91',
    vns:                 '0x247F31bB2b5a0d28E68bf24865AA242965FF99cd',
    explorerUrl:         'https://polygonscan.com',
  },
};

/** Get a ChainConfig by chainId. Returns undefined if not supported. */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return Object.values(CHAIN_CONFIGS).find(c => c.chainId === chainId);
}

// ─── Score Breakdown ────────────────────────────────────────────────────────

/** Breakdown of how Street Cred score was computed. */
export interface StreetCredBreakdown {
  /** Agent address is registered in the Identity Registry. Worth 30 points. */
  identityRegistered: boolean;
  /** Agent has at least one bond. Worth up to 25 points. */
  hasBond: boolean;
  /** At least one bond is currently active. Worth up to 15 points. */
  bondActive: boolean;
  /** Bonus points based on bond value tier. Range 0-20. */
  bondTierBonus: number;
  /** Agent has more than one active bond. Worth 5 points. */
  multipleBonds: boolean;
}

/** Street Cred composite trust score. */
export interface StreetCred {
  /** Composite trust score (0-95). */
  score: number;
  /** Maximum possible score. Always 95 in v1.0. */
  maxScore: 95;
  /** Named tier derived from score. */
  tier: TrustTier;
  /** Optional breakdown of score components. */
  breakdown?: StreetCredBreakdown;
}

// ─── Bond Summary ───────────────────────────────────────────────────────────

/** Summary of partnership bonds. */
export interface PartnershipBondSummary {
  /** Number of active partnership bonds. */
  count: number;
  /** Total ETH value of all active partnership bonds, as decimal string. */
  totalValue: string;
}

/** Summary of accountability bond status. */
export interface AccountabilityBondSummary {
  /** true = agent has an active accountability bond. */
  active: boolean;
}

/** Combined bond summary for all bond types. */
export interface BondSummary {
  partnership?: PartnershipBondSummary;
  accountability?: AccountabilityBondSummary;
}

// ─── Reputation Summary ─────────────────────────────────────────────────────

/** On-chain reputation summary from the Vaultfire Reputation contract. */
export interface ReputationSummary {
  /** Average feedback rating (0-100). */
  averageRating: number;
  /** Total number of feedback submissions received. */
  totalFeedbacks: number;
  /** Percentage of feedbacks from verified (bonded) parties. */
  verifiedPercentage: number;
}

// ─── Trust Extension Field ───────────────────────────────────────────────────

/**
 * The `trust` field added to A2A Agent Cards by the Vaultfire A2A Trust Extension.
 *
 * This is the canonical type for the trust extension. All fields marked as
 * required in the JSON Schema must be present.
 */
export interface VaultfireTrustExtension {
  /** Trust protocol identifier. Always "vaultfire". */
  protocol: 'vaultfire';
  /** Protocol version. This spec defines "1.0". */
  version: string;
  /** Name of the canonical chain for this agent's trust record. */
  chain: SupportedChain;
  /** EIP-155 chain ID. */
  chainId: SupportedChainId;
  /** Vaultfire Identity Registry contract address on the specified chain. */
  registryAddress: string;
  /** Agent's Ethereum address on the specified chain. */
  agentAddress: string;
  /** Street Cred composite score and breakdown. */
  streetCred?: StreetCred;
  /** Bond summary. */
  bonds?: BondSummary;
  /** Reputation summary. */
  reputation?: ReputationSummary;
  /** true if the agent passed baseline verification at verifiedAt. */
  verified: boolean;
  /** ISO 8601 UTC timestamp of last verification. */
  verifiedAt: string;
  /** Block explorer URL for the agent address. */
  explorer?: string;
}

// ─── A2A Agent Card ──────────────────────────────────────────────────────────

/**
 * Minimal A2A Agent Card structure.
 *
 * This is intentionally minimal — the full A2A Agent Card spec may include
 * additional fields. The `trust` field is the extension added by this spec.
 */
export interface A2AAgentCard {
  /** Human-readable agent name. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** URL at which the agent is reachable. */
  url?: string;
  /** Agent capabilities. */
  capabilities?: Record<string, boolean | string | number>;
  /** Vaultfire Trust Extension field. Optional. */
  trust?: VaultfireTrustExtension;
  /** Any additional A2A fields. */
  [key: string]: unknown;
}

// ─── Verification Options & Results ─────────────────────────────────────────

/** Options for verifying a trust extension. */
export interface VerifyOptions {
  /**
   * Minimum Street Cred score required to pass verification.
   * Default: 0 (any registered agent passes).
   */
  minScore?: number;
  /**
   * Minimum trust tier required.
   * Takes precedence over minScore if both are specified.
   */
  minTier?: TrustTier;
  /**
   * Maximum age of verifiedAt in seconds before the claim is considered stale.
   * Default: 3600 (1 hour).
   * Set to 0 to disable staleness checks.
   */
  maxAge?: number;
  /**
   * If true, perform a live on-chain re-verification rather than trusting
   * the presented data. Default: false (trust presented data, check staleness).
   */
  liveVerify?: boolean;
  /**
   * RPC override URLs keyed by chain name.
   * Falls back to default RPC URLs if not provided.
   */
  rpcOverrides?: Partial<Record<SupportedChain, string>>;
}

/** Result of a trust verification. */
export interface VerifyResult {
  /** true if verification passed all checks. */
  verified: boolean;
  /**
   * If verified is false, human-readable reason for failure.
   * May also contain warnings if verified is true.
   */
  reason?: string;
  /** Street Cred score at time of verification (from on-chain if liveVerify=true). */
  score?: number;
  /** Trust tier at time of verification. */
  tier?: TrustTier;
  /** Timestamp of when verification was performed. */
  checkedAt: string;
  /** Whether the data was from live on-chain reads or presented claims. */
  source: 'live' | 'presented';
}

// ─── Enrich Options ──────────────────────────────────────────────────────────

/** Options for enriching an Agent Card with trust data. */
export interface EnrichOptions {
  /** Target chain for trust data. Default: 'base'. */
  chain?: SupportedChain;
  /** Chain ID override. If not provided, derived from chain. */
  chainId?: SupportedChainId;
  /** RPC URL override. Falls back to default for the chain. */
  rpcUrl?: string;
  /** Whether to include the full breakdown in streetCred. Default: true. */
  includeBreakdown?: boolean;
  /** Whether to include reputation data. Default: true. */
  includeReputation?: boolean;
  /** Whether to include bond data. Default: true. */
  includeBonds?: boolean;
}

// ─── Multi-Chain Resolution ──────────────────────────────────────────────────

/** Trust data resolved from a single chain during multi-chain resolution. */
export interface ChainTrustResult {
  chain: SupportedChain;
  chainId: SupportedChainId;
  trust?: VaultfireTrustExtension;
  verified: boolean;
  score: number;
  tier: TrustTier;
  error?: string;
}

/** Result of multi-chain resolution. */
export interface MultiChainResult {
  /** Address that was resolved. */
  agentAddress: string;
  /** Per-chain results. */
  chains: ChainTrustResult[];
  /** The chain with the highest valid trust score. */
  bestChain?: SupportedChain;
  /** The highest Street Cred score found across all chains. */
  bestScore: number;
  /** The highest trust tier found across all chains. */
  bestTier: TrustTier;
  /** true if the agent was found on at least one chain. */
  foundOnAnyChain: boolean;
}
