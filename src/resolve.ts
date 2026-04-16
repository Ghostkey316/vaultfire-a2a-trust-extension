/**
 * resolve.ts — Multi-chain trust resolution
 *
 * Checks an agent's trust status across all four Vaultfire-supported chains
 * (Base, Avalanche, Arbitrum, Polygon) and returns the best (highest score)
 * result.
 *
 * This module also supports checking whether an agent is recognized via the
 * Vaultfire Bridge contract, which tracks cross-chain agent synchronization.
 *
 * All reads are read-only — no private key required.
 */

import { ethers } from 'ethers';
import {
  SupportedChain,
  CHAIN_CONFIGS,
  ChainTrustResult,
  MultiChainResult,
  VaultfireTrustExtension,
  SupportedChainId,
  scoreToTier,
} from './types';
import { computeStreetCred } from './verify';

// ─── ABI Fragments ───────────────────────────────────────────────────────────

const BRIDGE_ABI = [
  'function isAgentRecognized(address agent) view returns (bool)',
  'function getSyncedAgentCount() view returns (uint256)',
];

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function resolveOnChain(
  agentAddress: string,
  chain: SupportedChain,
  rpcOverride?: string,
): Promise<ChainTrustResult> {
  const config = CHAIN_CONFIGS[chain];

  try {
    const onChain = await computeStreetCred(agentAddress, chain, rpcOverride);

    const trust: VaultfireTrustExtension = {
      protocol:        'vaultfire',
      version:         '1.0',
      chain,
      chainId:         config.chainId as SupportedChainId,
      registryAddress: config.identityRegistry,
      agentAddress,
      streetCred: {
        score:     onChain.score,
        maxScore:  95,
        tier:      onChain.tier,
        breakdown: onChain.breakdown,
      },
      bonds: {
        partnership: {
          count:      onChain.bonds.partnership.count,
          totalValue: onChain.bonds.partnership.totalValue,
        },
        accountability: {
          active: onChain.bonds.accountability.active,
        },
      },
      ...(onChain.reputation.totalFeedbacks > 0 && {
        reputation: {
          averageRating:      onChain.reputation.averageRating,
          totalFeedbacks:     onChain.reputation.totalFeedbacks,
          verifiedPercentage: onChain.reputation.verifiedPercentage,
        },
      }),
      verified:   onChain.breakdown.identityRegistered,
      verifiedAt: new Date().toISOString(),
      explorer:   `${config.explorerUrl}/address/${agentAddress}`,
    };

    return {
      chain,
      chainId:  config.chainId as SupportedChainId,
      trust,
      verified: onChain.breakdown.identityRegistered,
      score:    onChain.score,
      tier:     onChain.tier,
    };
  } catch (err) {
    return {
      chain,
      chainId:  config.chainId as SupportedChainId,
      verified: false,
      score:    0,
      tier:     'none',
      error:    err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Bridge Check ─────────────────────────────────────────────────────────────

/**
 * Check whether an agent is recognized via the Vaultfire Bridge on a specific chain.
 *
 * The Bridge contract tracks cross-chain agent synchronization. An agent registered
 * on Base may be recognized on Avalanche via the bridge.
 *
 * @param agentAddress - Agent's Ethereum address.
 * @param chain        - Chain to check.
 * @param rpcOverride  - Optional RPC URL override.
 * @returns true if the agent is recognized on the specified chain.
 */
export async function checkBridgeRecognition(
  agentAddress: string,
  chain: SupportedChain,
  rpcOverride?: string,
): Promise<boolean> {
  const config = CHAIN_CONFIGS[chain];
  const rpcUrl = rpcOverride ?? config.rpcUrl;

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const bridge = new ethers.Contract(config.bridge, BRIDGE_ABI, provider);
    return await bridge.isAgentRecognized(agentAddress);
  } catch {
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve an agent's trust status across all four Vaultfire-supported chains.
 *
 * Checks Base, Avalanche, Arbitrum, and Polygon in parallel and returns
 * the result from each chain, plus a summary identifying the best (highest
 * Street Cred score) chain.
 *
 * @param agentAddress  - The agent's Ethereum address to resolve.
 * @param rpcOverrides  - Optional per-chain RPC URL overrides.
 * @returns MultiChainResult with per-chain data and a best-chain summary.
 *
 * @example
 * const result = await resolveMultiChain('0xA054f831B562e729F8D268291EBde1B2EDcFb84F');
 * console.log(`Best chain: ${result.bestChain}, score: ${result.bestScore}`);
 */
export async function resolveMultiChain(
  agentAddress: string,
  rpcOverrides?: Partial<Record<SupportedChain, string>>,
): Promise<MultiChainResult> {
  const chains: SupportedChain[] = ['base', 'avalanche', 'arbitrum', 'polygon'];

  // Check all chains in parallel
  const results = await Promise.all(
    chains.map(chain =>
      resolveOnChain(agentAddress, chain, rpcOverrides?.[chain]),
    ),
  );

  // Find the best valid result (highest score among verified agents)
  const validResults = results.filter(r => r.verified && r.score > 0);
  validResults.sort((a, b) => b.score - a.score);
  const best = validResults[0];

  return {
    agentAddress,
    chains:          results,
    bestChain:       best?.chain,
    bestScore:       best?.score ?? 0,
    bestTier:        best?.tier  ?? 'none',
    foundOnAnyChain: validResults.length > 0,
  };
}

/**
 * Find the primary chain for an agent — the chain where they have the highest trust score.
 *
 * This is a convenience wrapper over resolveMultiChain.
 *
 * @param agentAddress  - The agent's Ethereum address.
 * @param rpcOverrides  - Optional per-chain RPC URL overrides.
 * @returns The chain config for the best chain, or undefined if not found on any chain.
 */
export async function findPrimaryChain(
  agentAddress: string,
  rpcOverrides?: Partial<Record<SupportedChain, string>>,
): Promise<SupportedChain | undefined> {
  const result = await resolveMultiChain(agentAddress, rpcOverrides);
  return result.bestChain;
}

/**
 * Quick check: is this agent registered on ANY chain?
 *
 * @param agentAddress - The agent's Ethereum address.
 * @returns true if the agent is registered on at least one supported chain.
 */
export async function isAgentRegisteredAnywhere(
  agentAddress: string,
): Promise<boolean> {
  const result = await resolveMultiChain(agentAddress);
  return result.foundOnAnyChain;
}
