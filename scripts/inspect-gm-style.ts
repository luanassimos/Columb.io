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

    const mapElements = await page.evaluate(() => {
      const gmStyle = document.querySelector('.gm-style');
      if (!gmStyle) return 'No .gm-style found';
      
      const elements = gmStyle.querySelectorAll('*');
      const details: any[] = [];
      for (const el of elements) {
        const ariaLabel = el.getAttribute('aria-label');
        const role = el.getAttribute('role');
        const href = el.getAttribute('href');
        const jsaction = el.getAttribute('jsaction');
        if (ariaLabel || role || href || jsaction) {
          details.push({
            tagName: el.tagName,
            className: el.className,
            ariaLabel,
            role,
            href,
            jsaction
          });
        }
      }
      return details;
    });

    console.log(`Found ${Array.isArray(mapElements) ? mapElements.length : 0} interesting elements in .gm-style:`);
    if (Array.isArray(mapElements)) {
      console.log(JSON.stringify(mapElements.slice(0, 30), null, 2));
    } else {
      console.log(mapElements);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
