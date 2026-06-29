import { chromium } from 'playwright';

async function main() {
  const testUrls = [
    'https://www.linkedin.com/in/diegodallabona',
    'https://www.linkedin.com/in/maria-valdes-garcia-dmd-b76b43107',
    'https://www.linkedin.com/in/fake-profile-does-not-exist-123456789'
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  for (const url of testUrls) {
    console.log(`\nTesting URL: ${url}`);
    const page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const finalUrl = page.url();
      const status = response ? response.status() : 0;
      console.log(`Final URL: ${finalUrl}`);
      console.log(`HTTP Status: ${status}`);
    } catch (err: any) {
      console.log(`Error navigating: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

main().catch(console.error);
