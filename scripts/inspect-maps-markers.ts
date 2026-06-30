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

    // Let's inspect elements that might be markers
    const markerInfo = await page.evaluate(() => {
      const results: Record<string, number> = {};
      
      // Let's find all classes that contain 'marker' or 'pin'
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const className = el.className;
        if (typeof className === 'string' && className) {
          const classes = className.split(/\s+/);
          for (const c of classes) {
            if (c.toLowerCase().includes('marker') || c.toLowerCase().includes('pin')) {
              results[c] = (results[c] || 0) + 1;
            }
          }
        }
      }
      
      // Check for canvas elements (often Google Maps draws markers on a canvas)
      results['canvas_elements'] = document.querySelectorAll('canvas').length;
      
      // Check for image elements inside map area
      results['map_images'] = document.querySelectorAll('img[src*="maps"]').length;
      
      // Let's also check for buttons or divs with specific jsaction/jslog that could be pins
      // Google Maps pins often have a specific structure or can be matched with a selector
      const pins = document.querySelectorAll('.gm-style img, [jsaction*="click.pin"], [jsaction*="pin."]');
      results['pins_selector'] = pins.length;

      return {
        classes: results,
        totalElements: allElements.length
      };
    });

    console.log('Marker/Pin elements inspection:');
    console.log(JSON.stringify(markerInfo.classes, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
