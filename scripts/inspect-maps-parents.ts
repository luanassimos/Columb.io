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
      if (feedCards.length > 0) {
        const card = feedCards[0];
        console.log('\n--- CARD PARENT DETAILS ---');
        
        // Let's get parent of a.hfpxzc
        const parentInfo = await page.evaluate(el => {
          const parent = el.parentElement;
          if (!parent) return null;
          return {
            tagName: parent.tagName,
            className: parent.className,
            innerText: parent.innerText,
            outerHTML: parent.outerHTML
          };
        }, card);

        if (parentInfo) {
          console.log(`Parent Tag: ${parentInfo.tagName}`);
          console.log(`Parent Class: ${parentInfo.className}`);
          console.log(`Parent InnerText:\n${parentInfo.innerText}`);
          console.log(`Parent OuterHTML:\n${parentInfo.outerHTML.substring(0, 1500)}`);
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
