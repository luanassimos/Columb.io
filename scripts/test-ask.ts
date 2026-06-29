import { chromium } from 'playwright';

async function main() {
  const searchQuery = 'site:linkedin.com/in/ "Dentist" "Miami"';
  const askUrl = `https://www.ask.com/web?q=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating to: ${askUrl}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(askUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const content = await page.content();
  console.log(`Page title: ${await page.title()}`);
  
  // Ask.com results are typically in div.PartialSearchResults-item
  const results = await page.$$('.PartialSearchResults-item');
  console.log(`Found PartialSearchResults-item elements: ${results.length}`);
  
  if (results.length === 0) {
    console.log('Printing body text snippet:');
    const bodyText = await page.innerText('body');
    console.log(bodyText.substring(0, 1000));
  } else {
    for (let i = 0; i < Math.min(results.length, 3); i++) {
      const text = await results[i].innerText();
      console.log(`Result ${i + 1}: ${text.substring(0, 200)}`);
      
      const linkEl = await results[i].$('a.PartialSearchResults-item-title-link');
      if (linkEl) {
        console.log(`Link: ${await linkEl.getAttribute('href')}`);
      }
    }
  }

  await browser.close();
}

main().catch(console.error);
