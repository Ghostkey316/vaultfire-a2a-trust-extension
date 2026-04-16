/**
 * demo.ts — A2A Trust Extension Demo
 *
 * Demonstrates:
 * 1. Enriching a sample A2A Agent Card with live on-chain trust data
 * 2. Verifying the enriched card
 * 3. Running multi-chain resolution
 *
 * Run with: npm run demo
 *
 * No private key required — all reads are view-only.
 */

import { enrichAgentCard } from '../src/enrich';
import { verifyTrust, computeStreetCred } from '../src/verify';
import { resolveMultiChain } from '../src/resolve';
import { A2AAgentCard } from '../src/types';

// ─── Config ──────────────────────────────────────────────────────────────────

// Vaultfire deployer address — publicly known, used for demo
const DEMO_AGENT_ADDRESS = '0xA054f831B562e729F8D268291EBde1B2EDcFb84F';

// Sample A2A Agent Card (before enrichment)
const sampleCard: A2AAgentCard = {
  name:        'Vaultfire Demo Agent',
  description: 'An AI agent demonstrating the A2A Trust Extension.',
  url:         'https://theloopbreaker.com',
  capabilities: {
    text_generation: true,
    data_analysis:   true,
    contract_read:   true,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function section(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function info(label: string, value: unknown) {
  const str = typeof value === 'object'
    ? JSON.stringify(value, null, 4).replace(/^/gm, '  ')
    : String(value);
  console.log(`  ${label}: ${str}`);
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n');
  console.log('  ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗███████╗██╗██████╗ ███████╗');
  console.log('  ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝██╔════╝██║██╔══██╗██╔════╝');
  console.log('  ██║   ██║███████║██║   ██║██║     ██║   █████╗  ██║██████╔╝█████╗  ');
  console.log('  ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   ██╔══╝  ██║██╔══██╗██╔══╝  ');
  console.log('   ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   ██║     ██║██║  ██║███████╗');
  console.log('    ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝');
  console.log('\n  A2A Trust Extension Demo — Vaultfire Protocol');
  console.log('  Agent: ' + DEMO_AGENT_ADDRESS);

  // ── 1. Show sample card before enrichment ────────────────────────────────
  section('BEFORE: Sample A2A Agent Card (no trust data)');
  console.log(JSON.stringify(sampleCard, null, 2));

  // ── 2. Enrich with live on-chain data ────────────────────────────────────
  section('STEP 1: Enriching Agent Card with live on-chain data (Base)');
  console.log('  Connecting to Base mainnet...');
  console.log('  Reading Identity Registry, Partnership Bonds, Accountability Bond, Reputation...\n');

  let enriched: A2AAgentCard;
  try {
    enriched = await enrichAgentCard(sampleCard, DEMO_AGENT_ADDRESS, {
      chain: 'base',
    });

    ok('Agent Card enriched successfully');
    section('AFTER: Enriched A2A Agent Card (with trust data)');
    console.log(JSON.stringify(enriched, null, 2));
  } catch (err) {
    console.error('  Failed to enrich agent card:', err instanceof Error ? err.message : err);
    console.log('\n  (Continuing with demo using mock data to show verification flow)');

    // Fall back to mock data for demonstration
    enriched = {
      ...sampleCard,
      trust: {
        protocol:        'vaultfire',
        version:         '1.0',
        chain:           'base',
        chainId:         8453,
        registryAddress: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
        agentAddress:    DEMO_AGENT_ADDRESS,
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
        verifiedAt: new Date().toISOString(),
        explorer:   `https://basescan.org/address/${DEMO_AGENT_ADDRESS}`,
      },
    };
    console.log('\n  Using mock trust data:');
    console.log(JSON.stringify(enriched, null, 2));
  }

  // ── 3. Verify the enriched card ──────────────────────────────────────────
  section('STEP 2: Verifying the enriched Agent Card');

  const thresholdTests = [
    { label: 'Any registered agent (minScore: 1)',   opts: { minScore: 1 } },
    { label: 'Silver or above (minTier: silver)',    opts: { minTier: 'silver' as const } },
    { label: 'Gold or above (minTier: gold)',        opts: { minTier: 'gold' as const } },
    { label: 'Platinum required (minTier: platinum)',opts: { minTier: 'platinum' as const } },
  ];

  for (const test of thresholdTests) {
    const result = await verifyTrust(enriched, { ...test.opts, maxAge: 0 });
    const status = result.verified ? '✓ PASS' : '✗ FAIL';
    console.log(`  [${status}] ${test.label}`);
    if (!result.verified) {
      console.log(`         Reason: ${result.reason}`);
    }
  }

  // ── 4. Live Street Cred computation ─────────────────────────────────────
  section('STEP 3: Computing Street Cred score on Base mainnet');
  try {
    const streetCred = await computeStreetCred(DEMO_AGENT_ADDRESS, 'base');
    ok('Street Cred computed from live on-chain data');
    info('Score', `${streetCred.score}/95 (${streetCred.tier.toUpperCase()})`);
    info('Breakdown', streetCred.breakdown);
    info('Partnership bonds', streetCred.bonds.partnership);
    info('Accountability bond active', streetCred.bonds.accountability.active);
    if (streetCred.reputation.totalFeedbacks > 0) {
      info('Reputation', streetCred.reputation);
    } else {
      info('Reputation', '(no feedback yet)');
    }
  } catch (err) {
    console.log(`  Could not fetch live data: ${err instanceof Error ? err.message : err}`);
    console.log('  (RPC may be unavailable in this environment)');
  }

  // ── 5. Multi-chain resolution ────────────────────────────────────────────
  section('STEP 4: Multi-chain resolution (all 4 chains)');
  console.log('  Checking Base, Avalanche, Arbitrum, and Polygon in parallel...\n');

  try {
    const multiChain = await resolveMultiChain(DEMO_AGENT_ADDRESS);

    info('Agent found on chains', multiChain.foundOnAnyChain ? 'YES' : 'NO');
    if (multiChain.bestChain) {
      info('Best chain', multiChain.bestChain);
      info('Best score', `${multiChain.bestScore}/95 (${multiChain.bestTier.toUpperCase()})`);
    }

    console.log('\n  Per-chain results:');
    for (const chain of multiChain.chains) {
      const status = chain.verified ? `${chain.score}/95 ${chain.tier.toUpperCase()}` : 'Not registered';
      const errNote = chain.error ? ` (${chain.error.split('\n')[0]})` : '';
      console.log(`    ${chain.chain.padEnd(12)} chainId=${chain.chainId.toString().padEnd(6)} → ${status}${errNote}`);
    }
  } catch (err) {
    console.log(`  Multi-chain resolution failed: ${err instanceof Error ? err.message : err}`);
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  section('SUMMARY');
  console.log('  The A2A Trust Extension adds verifiable on-chain trust data to');
  console.log('  A2A Agent Cards, enabling agents to make trust decisions backed');
  console.log('  by economic accountability bonds on Base, Avalanche, Arbitrum,');
  console.log('  and Polygon.');
  console.log('');
  console.log('  SPEC:   ./SPEC.md');
  console.log('  SCHEMA: ./schemas/a2a-trust-extension.json');
  console.log('  PKG:    @vaultfire/a2a');
  console.log('  HUB:    https://theloopbreaker.com');
  console.log('');
}

main().catch(err => {
  console.error('\nDemo failed:', err);
  process.exit(1);
});
