/**
 * enrich.ts — Enrich an A2A Agent Card with Vaultfire trust data
 *
 * This module reads live on-chain data from the Vaultfire Protocol contracts
 * and adds the `trust` field to an A2A Agent Card.
 *
 * All on-chain reads are view-only — no private key required.
 */

import {
  A2AAgentCard,
  EnrichOptions,
  VaultfireTrustExtension,
  CHAIN_CONFIGS,
  SupportedChain,
  SupportedChainId,
} from './types';
import { computeStreetCred } from './verify';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function explorerUrl(explorerBase: string, agentAddress: string): string {
  return `${explorerBase}/address/${agentAddress}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enrich an A2A Agent Card with Vaultfire on-chain trust data.
 *
 * Reads live data from the Vaultfire Protocol contracts and adds the `trust`
 * field to the Agent Card. The original card is not mutated — a new object
 * is returned.
 *
 * No private key is required. All contract calls are read-only view functions.
 *
 * @param card          - The A2A Agent Card to enrich.
 * @param agentAddress  - The Ethereum address of the agent to look up.
 * @param options       - Enrichment options (chain, rpcUrl, etc.)
 * @returns A new Agent Card with the `trust` field populated.
 *
 * @example
 * const enriched = await enrichAgentCard(myCard, '0xA054f831B562e729F8D268291EBde1B2EDcFb84F');
 * console.log(enriched.trust?.streetCred?.score); // e.g. 55
 */
export async function enrichAgentCard(
  card: A2AAgentCard,
  agentAddress: string,
  options: EnrichOptions = {},
): Promise<A2AAgentCard> {
  const {
    chain = 'base',
    rpcUrl,
    includeBreakdown = true,
    includeReputation = true,
    includeBonds = true,
  } = options;

  const config = CHAIN_CONFIGS[chain];
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`);
  }

  // Read live on-chain data
  const onChain = await computeStreetCred(agentAddress, chain, rpcUrl);

  // Build trust extension object
  const trust: VaultfireTrustExtension = {
    protocol: 'vaultfire',
    version:  '1.0',
    chain,
    chainId: config.chainId as SupportedChainId,
    registryAddress: config.identityRegistry,
    agentAddress,
    streetCred: {
      score:    onChain.score,
      maxScore: 95,
      tier:     onChain.tier,
      ...(includeBreakdown && { breakdown: onChain.breakdown }),
    },
    ...(includeBonds && {
      bonds: {
        partnership: {
          count:      onChain.bonds.partnership.count,
          totalValue: onChain.bonds.partnership.totalValue,
        },
        accountability: {
          active: onChain.bonds.accountability.active,
        },
      },
    }),
    ...(includeReputation && onChain.reputation.totalFeedbacks > 0 && {
      reputation: {
        averageRating:      onChain.reputation.averageRating,
        totalFeedbacks:     onChain.reputation.totalFeedbacks,
        verifiedPercentage: onChain.reputation.verifiedPercentage,
      },
    }),
    verified:   onChain.breakdown.identityRegistered,
    verifiedAt: new Date().toISOString(),
    explorer:   explorerUrl(config.explorerUrl, agentAddress),
  };

  // Return new card (do not mutate original)
  return {
    ...card,
    trust,
  };
}

/**
 * Create a minimal A2A Agent Card with Vaultfire trust data.
 *
 * Useful for bootstrapping a new Agent Card from scratch.
 *
 * @param name         - Human-readable agent name.
 * @param agentAddress - The agent's Ethereum address.
 * @param options      - Optional card fields and enrichment options.
 * @returns A new Agent Card with the `trust` field populated.
 */
export async function createEnrichedAgentCard(
  name: string,
  agentAddress: string,
  options: EnrichOptions & {
    description?: string;
    url?: string;
    capabilities?: Record<string, boolean | string | number>;
  } = {},
): Promise<A2AAgentCard> {
  const { description, url, capabilities, ...enrichOptions } = options;

  const baseCard: A2AAgentCard = {
    name,
    ...(description && { description }),
    ...(url && { url }),
    ...(capabilities && { capabilities }),
  };

  return enrichAgentCard(baseCard, agentAddress, enrichOptions);
}

/**
 * Refresh the trust data in an already-enriched Agent Card.
 *
 * Preserves all non-trust fields and replaces the `trust` field with fresh
 * on-chain data.
 *
 * @param card - An already-enriched Agent Card.
 * @param options - Enrichment options. If not provided, uses chain from existing trust field.
 * @returns A new Agent Card with refreshed trust data.
 */
export async function refreshTrust(
  card: A2AAgentCard,
  options: EnrichOptions = {},
): Promise<A2AAgentCard> {
  if (!card.trust?.agentAddress) {
    throw new Error('Card has no trust.agentAddress — cannot refresh. Use enrichAgentCard instead.');
  }

  const chain = options.chain ?? card.trust.chain;
  const agentAddress = card.trust.agentAddress;

  return enrichAgentCard(card, agentAddress, { chain, ...options });
}
