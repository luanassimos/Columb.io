import { chromium } from 'playwright';

async function main() {
  const searchQuery = 'Dentist Miami LinkedIn';
  const url = `https://gibiru.com/results.html?q=${encodeURIComponent(searchQuery)}`;
  console.log(`Navigating Gibiru: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const links = await page.$$('a');
  console.log(`Total links found: ${links.length}`);
  
  for (const link of links) {
    const href = await link.getAttribute('href') || '';
    if (href.includes('linkedin.com/in/')) {
      const text = await link.innerText();
      
      // Let's get the parent HTML
      const parentHtml = await page.evaluate(el => el.parentElement ? el.parentElement.outerHTML : '', link);
      
      console.log(`\nLINK TEXT: ${text}`);
      console.log(`HREF: ${href}`);
      console.log(`PARENT HTML (first 500 chars): ${parentHtml.substring(0, 500)}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
