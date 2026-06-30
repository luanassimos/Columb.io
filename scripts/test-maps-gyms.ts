import { captureCompanyLeads } from '../lib/lead-services';

async function main() {
  console.log('--- STARTING COMPANY MAPS SCRAPER TEST ---');
  console.log('Target: Gym, San Francisco (Radius: 1km / Zoom 15z, Limit: 100)');
  
  // Set debug environment variable
  process.env.DEBUG_SCRAPER = 'true';
  
  const startTime = Date.now();
  const savedLeads: any[] = [];

  await captureCompanyLeads(
    'test-job-gym-sf',
    'Gym',
    'San Francisco',
    100,
    37.7749,
    -122.4194,
    1000, // 1 km
    false, // onlyEmail
    async (progress, lead) => {
      savedLeads.push(lead);
      console.log(`[CALLBACK SAVE ${progress}] NAME: "${lead.name}", MAPS_ID: "${lead.maps_url ? (lead.maps_url.match(/!19s([^!&?]+)/)?.[1] || '') : ''}", WEBSITE: "${lead.website}", PHONE: "${lead.phone}", ADDRESS: "${lead.address}"`);
      return true;
    }
  );

  const duration = (Date.now() - startTime) / 1000;
  
  console.log('\n====================================================================================================');
  console.log('                                  SCRAPER RESULTS SUMMARY');
  console.log('====================================================================================================');
  for (const lead of savedLeads) {
    console.log(`- ${lead.name} | ${lead.category} | Rating: ${lead.rating} | Lat: ${lead.lat}, Lng: ${lead.lng}`);
  }
  console.log('====================================================================================================');
  console.log(`Total Leads Saved: ${savedLeads.length}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
}

main().catch(console.error);
