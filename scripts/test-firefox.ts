import { firefox } from 'playwright';

async function main() {
  const searchQuery = 'site:linkedin.com/in/ "Dentist" "Miami"';
  const url = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating Bing on Firefox: ${url}`);

  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const content = await page.content();
  console.log(`Page title: ${await page.title()}`);
  
  const results = await page.$$('li.b_algo');
  console.log(`Found li.b_algo elements: ${results.length}`);

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
