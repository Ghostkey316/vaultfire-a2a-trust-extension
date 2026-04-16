/**
 * @vaultfire/a2a-trust-extension
 *
 * Reference implementation for the A2A Trust Extension — Vaultfire Protocol.
 *
 * Adds on-chain trust verification to A2A Agent Cards using the Vaultfire
 * Protocol contracts deployed on Base, Avalanche, Arbitrum, and Polygon.
 *
 * @see https://github.com/Ghostkey316/vaultfire-a2a-trust-extension
 * @see SPEC.md — Formal specification
 * @see schemas/a2a-trust-extension.json — JSON Schema
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  // Core extension type
  VaultfireTrustExtension,
  // Agent Card
  A2AAgentCard,
  // Score & tiers
  TrustTier,
  StreetCred,
  StreetCredBreakdown,
  // Bonds
  BondSummary,
  PartnershipBondSummary,
  AccountabilityBondSummary,
  // Reputation
  ReputationSummary,
  // Chain config
  SupportedChain,
  SupportedChainId,
  ChainConfig,
  // Verify
  VerifyOptions,
  VerifyResult,
  // Enrich
  EnrichOptions,
  // Multi-chain
  ChainTrustResult,
  MultiChainResult,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────
export {
  TIER_RANGES,
  CHAIN_CONFIGS,
  scoreToTier,
  getChainConfig,
} from './types';

// ─── Verify ───────────────────────────────────────────────────────────────────
export {
  verifyTrust,
  computeStreetCred,
  CANONICAL_REGISTRY_ADDRESSES,
} from './verify';

export type { OnChainStreetCred } from './verify';

// ─── Enrich ───────────────────────────────────────────────────────────────────
export {
  enrichAgentCard,
  createEnrichedAgentCard,
  refreshTrust,
} from './enrich';

// ─── Multi-Chain Resolution ───────────────────────────────────────────────────
export {
  resolveMultiChain,
  findPrimaryChain,
  isAgentRegisteredAnywhere,
  checkBridgeRecognition,
} from './resolve';
