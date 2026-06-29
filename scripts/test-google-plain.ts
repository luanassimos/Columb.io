import { chromium } from 'playwright';

async function main() {
  const searchQuery = 'Dentist Miami LinkedIn';
  const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating Google Search (plain): ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const content = await page.content();
  console.log(`Page title: ${await page.title()}`);
  
  const results = await page.$$('div.g');
  console.log(`Found div.g elements: ${results.length}`);

  if (results.length === 0) {
    console.log('Printing body text snippet:');
    const bodyText = await page.innerText('body');
    console.log(bodyText.substring(0, 1000));
  } else {
    for (let i = 0; i < Math.min(results.length, 5); i++) {
      const text = await results[i].innerText();
      console.log(`Result ${i + 1}: ${text.substring(0, 200)}`);
      
      const linkEl = await results[i].$('a');
      if (linkEl) {
        console.log(`Link: ${await linkEl.getAttribute('href')}`);
      }
    }
  }

  await browser.close();
}

main().catch(console.error);
