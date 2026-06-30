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

    const interactiveInfo = await page.evaluate(() => {
      const results: any[] = [];
      const selectors = ['button', 'a', '[role="button"]', '[role="img"]'];
      
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const ariaLabel = el.getAttribute('aria-label');
          const className = el.className;
          const text = el.textContent?.trim() || '';
          
          // Let's filter out sidebar feed elements to see what is elsewhere
          let isInsideFeed = false;
          let parent = el.parentElement;
          while (parent) {
            if (parent.getAttribute('role') === 'feed') {
              isInsideFeed = true;
              break;
            }
            parent = parent.parentElement;
          }
          
          if (!isInsideFeed) {
            results.push({
              selector: sel,
              tagName: el.tagName,
              className,
              ariaLabel,
              text: text.substring(0, 100)
            });
          }
        }
      }
      return results;
    });

    console.log(`Found ${interactiveInfo.length} interactive elements outside the feed:`);
    console.log(JSON.stringify(interactiveInfo.slice(0, 50), null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
