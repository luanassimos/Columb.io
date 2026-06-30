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

  page.on('response', async (response) => {
    const resUrl = response.url();
    if (resUrl.includes('search?') && (resUrl.includes('tbm=map') || resUrl.includes('pb='))) {
      console.log(`\n[Network Response] URL: ${resUrl.substring(0, 150)}...`);
      try {
        const text = await response.text();
        console.log(`Response length: ${text.length}`);
        console.log(`Response preview: ${text.substring(0, 300)}`);
      } catch (e: any) {
        console.log(`Failed to get response text: ${e.message}`);
      }
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(10000);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
