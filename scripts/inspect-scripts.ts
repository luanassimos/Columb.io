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

    const scriptInfo = await page.evaluate(() => {
      // Find all script tags
      const scripts = Array.from(document.querySelectorAll('script'));
      const results: string[] = [];
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('APP_INITIALIZATION_STATE') || content.includes('window.APP_STATE') || content.includes('initEmbed')) {
          results.push(content.substring(0, 500));
        }
      }
      
      // Also list global variables
      const globals: string[] = [];
      const keys = ['APP_INITIALIZATION_STATE', '_init_', 'google', 'maps', 'APP_STATE'];
      for (const k of keys) {
        if ((window as any)[k] !== undefined) {
          globals.push(k);
        }
      }
      
      return {
        scriptsFound: scripts.length,
        interestingSnippets: results,
        globals
      };
    });

    console.log('Script and Global variables inspection:');
    console.log(JSON.stringify(scriptInfo, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
