import { chromium } from 'playwright';

async function main() {
  const category = 'Gym';
  const lat = 37.7749;
  const lng = -122.4194;
  const zoom = 15;
  const url = `https://www.google.com/maps/search/${encodeURIComponent(category)}/@${lat},${lng},${zoom}z`;

  console.log(`Launching browser to query: ${url}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  let apiChIJCount = 0;
  const apiPlaceIds = new Set<string>();

  page.on('response', async (response) => {
    const resUrl = response.url();
    if (resUrl.includes('search?') && (resUrl.includes('tbm=map') || resUrl.includes('pb='))) {
      try {
        const text = await response.text();
        const matches = text.match(/ChIJ[a-zA-Z0-9_-]{23}/g) || [];
        for (const m of matches) {
          apiPlaceIds.add(m);
        }
        console.log(`[API Response] Found ${matches.length} matches of ChIJ, unique in this response: ${new Set(matches).size}. Total unique Place IDs in API so far: ${apiPlaceIds.size}`);
      } catch (e) {}
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);

    // Count in page content
    const content = await page.content();
    const contentMatches = content.match(/ChIJ[a-zA-Z0-9_-]{23}/g) || [];
    const uniqueContentMatches = new Set(contentMatches);

    console.log(`[Page Content] Unique ChIJ Place IDs found: ${uniqueContentMatches.size}`);
    
    // Let's also check if there are buttons with aria-label or other markers that represent the visible pins on map
    // Google Maps might render pins on canvas, but are there overlay icons or hidden elements?
    const markerElementsCount = await page.evaluate(() => {
      // In some rendering modes, Google Maps might have canvas but also SVG or images for pins.
      // Let's check for img elements with src containing "spotlight" or "pins" or similar.
      const images = Array.from(document.querySelectorAll('img'));
      const pinImages = images.filter(img => img.src.includes('marker') || img.src.includes('pin') || img.src.includes('spotlight'));
      return pinImages.length;
    });

    console.log(`[Marker Images] Count of pin/marker images: ${markerElementsCount}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
