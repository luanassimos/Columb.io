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

  let apiPlaceCount = 0;

  page.on('response', async (response) => {
    const resUrl = response.url();
    if (resUrl.includes('search?') && (resUrl.includes('tbm=map') || resUrl.includes('pb='))) {
      try {
        const text = await response.text();
        // Count occurrences of place patterns in response text
        const matches = text.match(/\/maps\/place\/[^"'\\]+/g) || [];
        const uniqueMatches = new Set(matches);
        apiPlaceCount += uniqueMatches.size;
        console.log(`[API Response] Found ${uniqueMatches.size} unique /maps/place/ URLs in API response.`);
      } catch (e) {}
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);

    // Count in window.APP_INITIALIZATION_STATE
    const statePlaceCount = await page.evaluate(() => {
      const state = (window as any).APP_INITIALIZATION_STATE;
      if (!state) return 0;
      const str = JSON.stringify(state);
      const matches = str.match(/\/maps\/place\/[^"'\\]+/g) || [];
      return new Set(matches).size;
    });

    console.log(`[State] Found ${statePlaceCount} unique /maps/place/ URLs in APP_INITIALIZATION_STATE.`);
    console.log(`[Total Estimate] APP_INITIALIZATION_STATE: ${statePlaceCount}, API responses: ${apiPlaceCount}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
