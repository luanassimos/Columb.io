import { areLeadsDuplicate } from '../lib/lead-providers/merge-engine';

console.log('Testing Name/Address Normalizations and Fuzzy Matching...');

const testCases = [
  {
    nameA: 'Google LLC',
    nameB: 'Google, Inc.',
    addrA: 'Av. Paulista, 1000',
    addrB: 'Avenida Paulista, 1000',
    expected: true
  },
  {
    nameA: 'Restaurante Sabor do Sul Ltda',
    nameB: 'Restaurante Sabor do Sul',
    addrA: 'Rua das Flores 123, SP',
    addrB: 'R. das Flores, 123',
    expected: true
  },
  {
    nameA: 'Dental Clinic',
    nameB: 'Dental Clinic',
    addrA: '123 Main St, Miami',
    addrB: '456 Broadway, New York',
    expected: false
  },
  {
    nameA: 'South Beach Gym',
    nameB: 'South Beach Gym',
    addrA: null,
    addrB: '123 Ocean Drive, Miami',
    expected: true
  }
];

let failed = 0;
for (const tc of testCases) {
  const result = areLeadsDuplicate(
    { name: tc.nameA, address: tc.addrA },
    { name: tc.nameB, address: tc.addrB }
  );
  if (result === tc.expected) {
    console.log(`✅ Passed: "${tc.nameA}" / "${tc.addrA}" VS "${tc.nameB}" / "${tc.addrB}" => duplicate: ${result}`);
  } else {
    console.error(`❌ Failed: "${tc.nameA}" / "${tc.addrA}" VS "${tc.nameB}" / "${tc.addrB}" => Got duplicate: ${result}, expected: ${tc.expected}`);
    failed++;
  }
}

if (failed === 0) {
  console.log('\nAll fuzzy merge tests passed! 🎉');
  process.exit(0);
} else {
  console.error(`\n${failed} tests failed.`);
  process.exit(1);
}
