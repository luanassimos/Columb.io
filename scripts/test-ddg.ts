import { chromium } from 'playwright';

async function main() {
  const searchQuery = 'site:linkedin.com/in/ "Dentist" "Miami"';
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating to: ${ddgUrl}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(ddgUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const content = await page.content();
  console.log(`Page contains "result" class: ${content.includes('class="result')}`);
  console.log(`Page contains "links" class: ${content.includes('class="links')}`);
  console.log(`Page contains "web-result" class: ${content.includes('web-result')}`);
  console.log(`Page title: ${await page.title()}`);

  const results = await page.$$('.result');
  console.log(`Found .result elements: ${results.length}`);
  
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
