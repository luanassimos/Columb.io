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

    const feed = await page.$('div[role="feed"]');
    if (feed) {
      const feedCards = await feed.$$('a[href*="/maps/place/"]');
      console.log(`Found ${feedCards.length} cards inside feed.`);

      for (let i = 0; i < Math.min(feedCards.length, 3); i++) {
        const card = feedCards[i];
        console.log(`\n--- Card ${i + 1} ---`);
        const text = await card.innerText();
        const href = await card.getAttribute('href');
        const ariaLabel = await card.getAttribute('aria-label');
        const outerHTML = await page.evaluate(el => el.outerHTML, card);

        console.log(`aria-label: ${ariaLabel}`);
        console.log(`innerText:\n${text}`);
        console.log(`href: ${href}`);
        console.log(`outerHTML snippet: ${outerHTML.substring(0, 1500)}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
