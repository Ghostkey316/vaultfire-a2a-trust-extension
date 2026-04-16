/**
 * verify.test.ts — Tests for the verifyTrust function
 *
 * Tests the validation logic without making live on-chain calls.
 * Live on-chain tests are in the demo script.
 */

import { verifyTrust, CANONICAL_REGISTRY_ADDRESSES } from '../src/verify';
import { A2AAgentCard, VaultfireTrustExtension } from '../src/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTrust(overrides: Partial<VaultfireTrustExtension> = {}): VaultfireTrustExtension {
  return {
    protocol:        'vaultfire',
    version:         '1.0',
    chain:           'base',
    chainId:         8453,
    registryAddress: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
    agentAddress:    '0xA054f831B562e729F8D268291EBde1B2EDcFb84F',
    streetCred: {
      score:    55,
      maxScore: 95,
      tier:     'silver',
      breakdown: {
        identityRegistered: true,
        hasBond:            true,
        bondActive:         true,
        bondTierBonus:      0,
        multipleBonds:      false,
      },
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
    verified:   true,
    verifiedAt: new Date().toISOString(), // Fresh — no staleness
    explorer:   'https://basescan.org/address/0xA054f831B562e729F8D268291EBde1B2EDcFb84F',
    ...overrides,
  };
}

function makeCard(trustOverrides?: Partial<VaultfireTrustExtension>): A2AAgentCard {
  return {
    name:        'Test Agent',
    description: 'A test agent',
    trust:       makeTrust(trustOverrides),
  };
}

// ─── Tests: Missing trust field ───────────────────────────────────────────────

describe('verifyTrust — missing trust field', () => {
  test('returns false if trust field is absent', async () => {
    const card: A2AAgentCard = { name: 'No Trust Agent' };
    const result = await verifyTrust(card);
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('no trust field');
  });
});

// ─── Tests: Protocol validation ───────────────────────────────────────────────

describe('verifyTrust — protocol validation', () => {
  test('rejects unknown protocol', async () => {
    const card = makeCard({ protocol: 'unknown' as 'vaultfire' });
    const result = await verifyTrust(card);
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('Unknown trust protocol');
  });

  test('rejects unknown version', async () => {
    const card = makeCard({ version: '9.9' });
    const result = await verifyTrust(card);
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('Unsupported trust extension version');
  });

  test('accepts vaultfire version 1.0', async () => {
    const card = makeCard({ protocol: 'vaultfire', version: '1.0' });
    const result = await verifyTrust(card, { maxAge: 0 });
    expect(result.verified).toBe(true);
  });
});

// ─── Tests: Registry address validation ───────────────────────────────────────

describe('verifyTrust — registry address validation', () => {
  test('rejects wrong registry address for Base', async () => {
    const card = makeCard({ registryAddress: '0x1234567890123456789012345678901234567890' });
    const result = await verifyTrust(card);
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('does not match canonical address');
  });

  test('rejects unknown chainId', async () => {
    const card = makeCard({ chainId: 9999 as 8453 });
    const result = await verifyTrust(card);
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('Unsupported chainId');
  });

  test('accepts correct Base registry address', async () => {
    const card = makeCard({
      chainId:         8453,
      registryAddress: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
    });
    const result = await verifyTrust(card, { maxAge: 0 });
    expect(result.verified).toBe(true);
  });

  test('canonical addresses are consistent with CHAIN_CONFIGS', () => {
    // Base
    expect(CANONICAL_REGISTRY_ADDRESSES[8453]).toBe('0x35978DB675576598F0781dA2133E94cdCf4858bC');
    // Avalanche
    expect(CANONICAL_REGISTRY_ADDRESSES[43114]).toBe('0x57741F4116925341d8f7Eb3F381d98e07C73B4a3');
    // Arbitrum
    expect(CANONICAL_REGISTRY_ADDRESSES[42161]).toBe('0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1');
    // Polygon
    expect(CANONICAL_REGISTRY_ADDRESSES[137]).toBe('0x6298c62FDA57276DC60de9E716fbBAc23d06D5F1');
  });
});

// ─── Tests: Staleness ─────────────────────────────────────────────────────────

describe('verifyTrust — staleness', () => {
  test('rejects stale data (verifiedAt 2 hours ago, maxAge 1 hour)', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const card = makeCard({ verifiedAt: twoHoursAgo });
    const result = await verifyTrust(card, { maxAge: 3600 });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('stale');
  });

  test('accepts fresh data', async () => {
    const card = makeCard({ verifiedAt: new Date().toISOString() });
    const result = await verifyTrust(card, { maxAge: 3600 });
    expect(result.verified).toBe(true);
  });

  test('disabling maxAge (maxAge: 0) bypasses staleness check', async () => {
    const veryOld = new Date(2020, 1, 1).toISOString();
    const card = makeCard({ verifiedAt: veryOld });
    const result = await verifyTrust(card, { maxAge: 0 });
    expect(result.verified).toBe(true);
  });
});

// ─── Tests: Score thresholds ──────────────────────────────────────────────────

describe('verifyTrust — score and tier thresholds', () => {
  test('passes when score meets minimum', async () => {
    const card = makeCard({ streetCred: { score: 55, maxScore: 95, tier: 'silver' } });
    const result = await verifyTrust(card, { minScore: 31, maxAge: 0 });
    expect(result.verified).toBe(true);
    expect(result.score).toBe(55);
    expect(result.tier).toBe('silver');
  });

  test('fails when score is below minimum', async () => {
    const card = makeCard({ streetCred: { score: 30, maxScore: 95, tier: 'bronze' } });
    const result = await verifyTrust(card, { minScore: 31, maxAge: 0 });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('below required minimum');
  });

  test('passes with minTier: bronze', async () => {
    const card = makeCard({ streetCred: { score: 30, maxScore: 95, tier: 'bronze' } });
    const result = await verifyTrust(card, { minTier: 'bronze', maxAge: 0 });
    expect(result.verified).toBe(true);
  });

  test('passes with minTier: silver when tier is gold', async () => {
    const card = makeCard({ streetCred: { score: 60, maxScore: 95, tier: 'gold' } });
    const result = await verifyTrust(card, { minTier: 'silver', maxAge: 0 });
    expect(result.verified).toBe(true);
  });

  test('fails with minTier: gold when tier is silver', async () => {
    const card = makeCard({ streetCred: { score: 55, maxScore: 95, tier: 'silver' } });
    const result = await verifyTrust(card, { minTier: 'gold', maxAge: 0 });
    expect(result.verified).toBe(false);
    // The score check fires first (55 < 56, the minimum for gold tier)
    expect(result.reason).toBeTruthy();
    expect(result.reason).toMatch(/below required minimum|does not meet required minimum tier/);
  });

  test('fails when trust.verified is false', async () => {
    const card = makeCard({ verified: false });
    const result = await verifyTrust(card, { maxAge: 0 });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('trust.verified is false');
  });
});

// ─── Tests: Result shape ──────────────────────────────────────────────────────

describe('verifyTrust — result shape', () => {
  test('result has checkedAt timestamp', async () => {
    const card = makeCard();
    const result = await verifyTrust(card, { maxAge: 0 });
    expect(result.checkedAt).toBeTruthy();
    expect(new Date(result.checkedAt).getTime()).toBeGreaterThan(0);
  });

  test('result source is "presented" for non-live verification', async () => {
    const card = makeCard();
    const result = await verifyTrust(card, { maxAge: 0 });
    expect(result.source).toBe('presented');
  });

  test('failed result has reason string', async () => {
    const card: A2AAgentCard = { name: 'No Trust' };
    const result = await verifyTrust(card);
    expect(result.verified).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason!.length).toBeGreaterThan(0);
  });
});
