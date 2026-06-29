import { captureProfessionalLeads } from '../lib/lead-services';

async function main() {
  console.log('--- STARTING PROFESSIONAL FINDER SEMANTIC TEST ---');
  console.log('Target: Dentist, San Francisco (Limit: 10)');
  const startTime = Date.now();
  
  const savedLeads: any[] = [];

  await captureProfessionalLeads(
    'test-job-id-sf',
    'Dentist',
    'San Francisco',
    'city', // precision passed via keywords
    10,
    async (progress, lead) => {
      savedLeads.push(lead);
      console.log(`\n--- SAVED LEAD CALLBACK ---`);
      console.log(`NAME: ${lead.display_name}`);
      console.log(`RAW_HREF: ${lead.raw_href}`);
      console.log(`FINAL_URL: ${lead.profile_url}`);
      console.log(`HTTP_STATUS: ${lead.http_status}`);
      return true;
    }
  );

  const duration = (Date.now() - startTime) / 1000;
  
  console.log('\n====================================================================================================');
  console.log('                                  TEST RESULTS SUMMARY TABLE');
  console.log('====================================================================================================');
  console.log(
    'NAME'.padEnd(25) + ' | ' +
    'HTTP'.padEnd(5) + ' | ' +
    'RAW_HREF'.padEnd(65) + ' | ' +
    'FINAL_URL'
  );
  console.log('-'.repeat(120));
  
  for (const lead of savedLeads) {
    console.log(
      (lead.display_name || '').substring(0, 25).padEnd(25) + ' | ' +
      String(lead.http_status || '').padEnd(5) + ' | ' +
      (lead.raw_href || '').substring(0, 65).padEnd(65) + ' | ' +
      (lead.profile_url || '')
    );
  }
  console.log('====================================================================================================');
  console.log(`Total Valid Leads Saved: ${savedLeads.length}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);

  if (savedLeads.length < 10) {
    console.warn(`\nWARNING: Found ${savedLeads.length} leads. Target was >= 10.`);
  } else {
    console.log(`\nSUCCESS: Achieved target of ${savedLeads.length} leads.`);
  }

  // Verify that no lead has a 404 status
  const has404 = savedLeads.some(lead => lead.http_status === 404);
  if (has404) {
    console.error('FAIL: One or more leads returned HTTP 404 status!');
    process.exit(1);
  } else {
    console.log('SUCCESS: Checked all saved leads. 0 URLs returned 404 status.');
  }

  if (duration > 60) {
    console.warn(`WARNING: Search took ${duration.toFixed(2)} seconds (exceeded 60s target).`);
  } else {
    console.log(`SUCCESS: Execution completed in under 60 seconds.`);
  }
}

main().catch(console.error);
