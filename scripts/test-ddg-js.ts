import { chromium } from 'playwright';

async function main() {
  const searchQuery = 'site:linkedin.com/in/ "Dentist" "Miami"';
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating to: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(4000);

  const content = await page.content();
  console.log(`Page title: ${await page.title()}`);
  
  // Regular DDG results have article element or a.result__a or similar
  const results = await page.$$('article');
  console.log(`Found article elements: ${results.length}`);

  const resultsLinks = await page.$$('a[data-testid="result-title-a"]');
  console.log(`Found result links: ${resultsLinks.length}`);

  if (resultsLinks.length === 0) {
    console.log('Printing body text snippet:');
    const bodyText = await page.innerText('body');
    console.log(bodyText.substring(0, 1000));
  } else {
    for (let i = 0; i < Math.min(resultsLinks.length, 3); i++) {
      const text = await resultsLinks[i].innerText();
      const href = await resultsLinks[i].getAttribute('href');
      console.log(`Result ${i + 1}: ${text} -> ${href}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
