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

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const result = await page.evaluate(() => {
      const state = (window as any).APP_INITIALIZATION_STATE;
      if (!state) return 'No state';
      
      // Let's inspect sizes of elements inside state
      const summary: any = {};
      for (let i = 0; i < state.length; i++) {
        if (state[i]) {
          summary[`index_${i}`] = {
            type: typeof state[i],
            length: Array.isArray(state[i]) ? state[i].length : null,
            preview: String(state[i]).substring(0, 200)
          };
        }
      }
      return summary;
    });

    console.log('APP_INITIALIZATION_STATE layout:');
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
