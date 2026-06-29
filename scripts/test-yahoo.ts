import { chromium } from 'playwright';

async function main() {
  const searchQuery = 'site:linkedin.com/in/ "Dentist" "Miami"';
  const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating to: ${yahooUrl}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(yahooUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const content = await page.content();
  console.log(`Page title: ${await page.title()}`);
  
  // Yahoo results are typically inside div.algo-srv or inside elements with class including "compTitle" or "SearchResult" or "algo"
  const hasAlgo = content.includes('class="algo') || content.includes('algo');
  console.log(`Page contains "algo" class: ${hasAlgo}`);

  const results = await page.$$('.algo');
  console.log(`Found .algo elements: ${results.length}`);
  
  if (results.length === 0) {
    console.log('Printing body text snippet:');
    const bodyText = await page.innerText('body');
    console.log(bodyText.substring(0, 1000));
  } else {
    for (let i = 0; i < Math.min(results.length, 3); i++) {
      const text = await results[i].innerText();
      console.log(`Result ${i + 1}: ${text.substring(0, 200)}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
