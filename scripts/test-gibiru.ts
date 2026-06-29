import { chromium } from 'playwright';

async function main() {
  const searchQuery = 'Dentist Miami LinkedIn';
  const url = `https://gibiru.com/results.html?q=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating Gibiru: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const content = await page.content();
  console.log(`Page title: ${await page.title()}`);
  
  // Gibiru results are typically inside div.g-rst
  const results = await page.$$('.g-rst');
  console.log(`Found .g-rst elements: ${results.length}`);

  if (results.length === 0) {
    const results2 = await page.$$('.results');
    console.log(`Found .results elements: ${results2.length}`);
  }

  const links = await page.$$('a');
  console.log(`Total links found: ${links.length}`);
  
  // Let's find any link that contains linkedin.com/in/
  let linkedinCount = 0;
  for (const link of links) {
    const href = await link.getAttribute('href') || '';
    if (href.includes('linkedin.com/in/')) {
      linkedinCount++;
      console.log(`LinkedIn link found: ${href}`);
    }
  }
  console.log(`Total LinkedIn links: ${linkedinCount}`);

  await browser.close();
}

main().catch(console.error);
