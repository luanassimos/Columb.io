/**
 * instrumentation.ts
 *
 * Runs once when the Next.js server starts (before handling any requests).
 * Bootstraps background workers so no separate terminal is needed:
 *  - Lead Worker  (Playwright + Google Maps scraping)
 *  - Enrichment Worker (website channel crawling + scoring)
 */
export async function register() {
  // Only run in the Node.js server runtime — never in Edge or browser bundles
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Dynamically import to avoid bundling Playwright into the Edge runtime
  const { startLeadWorker } = await import('@/lib/workers/lead-worker-loop');
  const { startEnrichmentWorker } = await import('@/lib/workers/enrichment-worker-loop');

  startLeadWorker();
  startEnrichmentWorker();
}
