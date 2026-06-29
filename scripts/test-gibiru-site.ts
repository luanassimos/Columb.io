import { chromium } from 'playwright';

async function main() {
  const searchQuery = 'site:linkedin.com/in/ "Dentist" "San Francisco"';
  const url = `https://gibiru.com/results.html?q=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating Gibiru: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const links = await page.$$('a');
  console.log(`Total links found: ${links.length}`);
  
  let linkedinCount = 0;
  for (const link of links) {
    const href = await link.getAttribute('href') || '';
    if (href.includes('linkedin.com/in/')) {
      linkedinCount++;
      const text = await link.innerText();
      console.log(`[${linkedinCount}] Title: ${text} -> Href: ${href}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
