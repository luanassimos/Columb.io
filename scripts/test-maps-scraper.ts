import { chromium } from 'playwright';

async function main() {
  const category = 'Gym';
  const lat = 37.7749;
  const lng = -122.4194;
  const zoom = 15; // 1 km approx
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

    console.log(`Page title: ${await page.title()}`);

    // Let's find feed container
    const feed = await page.$('div[role="feed"]');
    if (feed) {
      console.log('Found div[role="feed"]!');
      
      // Let's see what cards are inside the feed
      const feedCards = await feed.$$('a[href*="/maps/place/"]');
      console.log(`Number of a[href*="/maps/place/"] inside feed: ${feedCards.length}`);

      for (let i = 0; i < Math.min(feedCards.length, 5); i++) {
        const text = await feedCards[i].innerText();
        const href = await feedCards[i].getAttribute('href');
        const ariaLabel = await feedCards[i].getAttribute('aria-label');
        console.log(`Card ${i + 1}: aria-label="${ariaLabel}", text="${text.replace(/\n/g, ' ')}", href="${href?.substring(0, 60)}..."`);
      }
    } else {
      console.log('Could NOT find div[role="feed"]');
    }

    // Let's see overall cards on the page
    const allCards = await page.$$('a[href*="/maps/place/"]');
    console.log(`Total a[href*="/maps/place/"] on page: ${allCards.length}`);

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
