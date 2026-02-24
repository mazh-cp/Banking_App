/**
 * Calibration / evaluation script: fetch /guard/results for given request IDs.
 * NOT used in runtime. Run manually or in a job to analyze Guard decisions for tuning.
 *
 * Usage:
 *   LAKERA_API_KEY=sk-... REQUEST_IDS=id1,id2 pnpm exec tsx scripts/lakera-calibration.ts
 *   Or pass request IDs in a file: REQUEST_IDS_FILE=./request_ids.txt pnpm exec tsx scripts/lakera-calibration.ts
 */

import { fetchGuardResultsForCalibration } from '../src/lib/security/lakera-guard';

async function main() {
  const apiKey = process.env.LAKERA_API_KEY || process.env.LAKERA_GUARD_API_KEY;
  if (!apiKey) {
    console.error('Set LAKERA_API_KEY or LAKERA_GUARD_API_KEY');
    process.exit(1);
  }

  let requestIds: string[] = [];
  const fromEnv = process.env.REQUEST_IDS;
  if (fromEnv) {
    requestIds = fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const filePath = process.env.REQUEST_IDS_FILE;
  if (filePath) {
    try {
      const fs = await import('fs');
      const content = fs.readFileSync(filePath, 'utf-8');
      requestIds = content.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    } catch (e) {
      console.error('Failed to read REQUEST_IDS_FILE:', e);
      process.exit(1);
    }
  }

  if (requestIds.length === 0) {
    console.log('Usage: REQUEST_IDS=id1,id2 pnpm exec tsx scripts/lakera-calibration.ts');
    console.log('   or: REQUEST_IDS_FILE=./ids.txt pnpm exec tsx scripts/lakera-calibration.ts');
    process.exit(0);
  }

  for (const requestId of requestIds) {
    const results = await fetchGuardResultsForCalibration(requestId, apiKey);
    console.log(JSON.stringify({ requestId, results }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
