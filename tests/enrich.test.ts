/**
 * enrich.test.ts — Tests for the enrichAgentCard and related functions
 *
 * Tests the enrichment logic and shape of the output. For live on-chain
 * enrichment tests, see the demo script.
 *
 * These tests mock the computeStreetCred function to avoid live network calls.
 */

import { enrichAgentCard, refreshTrust, createEnrichedAgentCard } from '../src/enrich';
import * as verify from '../src/verify';
import { A2AAgentCard, CHAIN_CONFIGS } from '../src/types';

// ─── Mock computeStreetCred ───────────────────────────────────────────────────

const mockStreetCredData = {
  score: 55,
  tier:  'silver' as const,
  breakdown: {
    identityRegistered: true,
    hasBond:            true,
    bondActive:         true,
    bondTierBonus:      0,
    multipleBonds:      false,
  },
  bonds: {
    partnership:    { count: 1, totalValue: '0.01' },
    accountability: { active: true },
  },
  reputation: {
    averageRating:      85,
    totalFeedbacks:     12,
    verifiedPercentage: 75,
  },
};

beforeEach(() => {
  jest.spyOn(verify, 'computeStreetCred').mockResolvedValue(mockStreetCredData);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_AGENT_ADDRESS = '0xA054f831B562e729F8D268291EBde1B2EDcFb84F';

const baseCard: A2AAgentCard = {
  name:        'Test Agent',
  description: 'A test agent for enrichment tests',
  url:         'https://example.com',
  capabilities: { text_generation: true },
};

// ─── Tests: enrichAgentCard ───────────────────────────────────────────────────

describe('enrichAgentCard', () => {
  test('adds trust field to the agent card', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust).toBeDefined();
  });

  test('does not mutate the original card', async () => {
    const original = { ...baseCard };
    await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(baseCard).toEqual(original);
  });

  test('preserves existing card fields', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.name).toBe(baseCard.name);
    expect(enriched.description).toBe(baseCard.description);
    expect(enriched.url).toBe(baseCard.url);
    expect(enriched.capabilities).toEqual(baseCard.capabilities);
  });

  test('trust field has correct protocol and version', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.protocol).toBe('vaultfire');
    expect(enriched.trust?.version).toBe('1.0');
  });

  test('trust field reflects correct chain (default: base)', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.chain).toBe('base');
    expect(enriched.trust?.chainId).toBe(8453);
  });

  test('trust field uses canonical registry address', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.registryAddress).toBe(CHAIN_CONFIGS.base.identityRegistry);
  });

  test('trust field stores agent address', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.agentAddress).toBe(MOCK_AGENT_ADDRESS);
  });

  test('trust.streetCred matches mock data', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.streetCred?.score).toBe(55);
    expect(enriched.trust?.streetCred?.tier).toBe('silver');
    expect(enriched.trust?.streetCred?.maxScore).toBe(95);
  });

  test('trust.streetCred includes breakdown by default', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.streetCred?.breakdown).toBeDefined();
    expect(enriched.trust?.streetCred?.breakdown?.identityRegistered).toBe(true);
  });

  test('trust.streetCred excludes breakdown when includeBreakdown=false', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS, {
      includeBreakdown: false,
    });
    expect(enriched.trust?.streetCred?.breakdown).toBeUndefined();
  });

  test('trust.bonds is included by default', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.bonds).toBeDefined();
    expect(enriched.trust?.bonds?.partnership?.count).toBe(1);
    expect(enriched.trust?.bonds?.accountability?.active).toBe(true);
  });

  test('trust.bonds is excluded when includeBonds=false', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS, {
      includeBonds: false,
    });
    expect(enriched.trust?.bonds).toBeUndefined();
  });

  test('trust.reputation is included when totalFeedbacks > 0', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.reputation).toBeDefined();
    expect(enriched.trust?.reputation?.averageRating).toBe(85);
    expect(enriched.trust?.reputation?.totalFeedbacks).toBe(12);
    expect(enriched.trust?.reputation?.verifiedPercentage).toBe(75);
  });

  test('trust.reputation is omitted when totalFeedbacks = 0', async () => {
    jest.spyOn(verify, 'computeStreetCred').mockResolvedValue({
      ...mockStreetCredData,
      reputation: { averageRating: 0, totalFeedbacks: 0, verifiedPercentage: 0 },
    });
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.reputation).toBeUndefined();
  });

  test('trust.verified is true when agent is registered', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.verified).toBe(true);
  });

  test('trust.verified is false when agent is not registered', async () => {
    jest.spyOn(verify, 'computeStreetCred').mockResolvedValue({
      ...mockStreetCredData,
      score:    0,
      tier:     'none',
      breakdown: { ...mockStreetCredData.breakdown, identityRegistered: false },
    });
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.verified).toBe(false);
  });

  test('trust.verifiedAt is a valid ISO timestamp', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    const ts = enriched.trust?.verifiedAt;
    expect(ts).toBeTruthy();
    expect(() => new Date(ts!)).not.toThrow();
    expect(new Date(ts!).getTime()).toBeGreaterThan(0);
  });

  test('trust.explorer is a valid URL', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    expect(enriched.trust?.explorer).toContain('basescan.org');
    expect(enriched.trust?.explorer).toContain(MOCK_AGENT_ADDRESS);
  });

  test('uses Avalanche config when chain=avalanche', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS, {
      chain: 'avalanche',
    });
    expect(enriched.trust?.chain).toBe('avalanche');
    expect(enriched.trust?.chainId).toBe(43114);
    expect(enriched.trust?.registryAddress).toBe(CHAIN_CONFIGS.avalanche.identityRegistry);
  });

  test('throws for unsupported chain', async () => {
    await expect(
      enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS, { chain: 'unknown' as 'base' })
    ).rejects.toThrow('Unsupported chain');
  });
});

// ─── Tests: createEnrichedAgentCard ──────────────────────────────────────────

describe('createEnrichedAgentCard', () => {
  test('creates a minimal card with trust data', async () => {
    const card = await createEnrichedAgentCard('My Agent', MOCK_AGENT_ADDRESS);
    expect(card.name).toBe('My Agent');
    expect(card.trust).toBeDefined();
    expect(card.trust?.agentAddress).toBe(MOCK_AGENT_ADDRESS);
  });

  test('includes description when provided', async () => {
    const card = await createEnrichedAgentCard('My Agent', MOCK_AGENT_ADDRESS, {
      description: 'A helpful agent',
    });
    expect(card.description).toBe('A helpful agent');
  });

  test('includes url when provided', async () => {
    const card = await createEnrichedAgentCard('My Agent', MOCK_AGENT_ADDRESS, {
      url: 'https://myagent.example.com',
    });
    expect(card.url).toBe('https://myagent.example.com');
  });
});

// ─── Tests: refreshTrust ─────────────────────────────────────────────────────

describe('refreshTrust', () => {
  test('throws if card has no trust field', async () => {
    const card: A2AAgentCard = { name: 'No Trust Card' };
    await expect(refreshTrust(card)).rejects.toThrow('no trust.agentAddress');
  });

  test('refreshes trust data preserving other fields', async () => {
    const enriched = await enrichAgentCard(baseCard, MOCK_AGENT_ADDRESS);
    // Simulate stale data by overwriting verifiedAt
    enriched.trust!.verifiedAt = '2020-01-01T00:00:00Z';

    const refreshed = await refreshTrust(enriched);
    expect(refreshed.name).toBe(enriched.name);
    expect(refreshed.trust?.agentAddress).toBe(MOCK_AGENT_ADDRESS);
    // verifiedAt should be updated
    expect(refreshed.trust?.verifiedAt).not.toBe('2020-01-01T00:00:00Z');
  });
});
