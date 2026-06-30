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

    const layout = await page.evaluate(() => {
      // Find all divs that are direct children of body, or large divs
      const elements = Array.from(document.querySelectorAll('body > div, #app-container, #content-container, .widget-scene, canvas'));
      return elements.map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label')
      }));
    });

    console.log('Top-level containers:');
    console.log(JSON.stringify(layout, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
