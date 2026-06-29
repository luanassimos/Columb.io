// Use global fetch

async function testFetch(urlStr: string) {
  console.log(`\nFetching: ${urlStr}`);
  try {
    const res = await fetch(urlStr, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    console.log(`Status: ${res.status}`);
    console.log(`Final URL: ${res.url}`);
    const text = await res.text();
    console.log(`Text includes "Page not found" / "não encontrado": ${
      text.toLowerCase().includes('page not found') || 
      text.toLowerCase().includes('perfil não encontrado') ||
      text.toLowerCase().includes('cannot be found') ||
      text.toLowerCase().includes('esta página não existe')
    }`);
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
}

async function main() {
  await testFetch('https://www.linkedin.com/in/diegodallabona');
  await testFetch('https://www.linkedin.com/in/maria-valdes-garcia-dmd-b76b43107');
  await testFetch('https://www.linkedin.com/in/fake-profile-does-not-exist-123456789');
}

main().catch(console.error);
