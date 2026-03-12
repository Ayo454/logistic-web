// Quick test to verify the logistics API is working
import http from 'http';

const testEndpoints = [
  { url: 'http://localhost:3000/api/users', name: 'GET /api/users' },
  { url: 'http://localhost:3000/api/notifications', name: 'GET /api/notifications' },
  { url: 'http://localhost:3000/api/shipments', name: 'GET /api/shipments' },
];

async function testApi(urlStr, name) {
  return new Promise((resolve) => {
    http.get(urlStr, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n✓ ${name}`);
        console.log(`  Status: ${res.statusCode}`);
        console.log(`  Response: ${data.substring(0, 200)}`);
        resolve();
      });
    }).on('error', (err) => {
      console.log(`\n✗ ${name}`);
      console.log(`  Error: ${err.message}`);
      resolve();
    });
  });
}

console.log('Testing logistics API endpoints...\n');
for (const endpoint of testEndpoints) {
  await testApi(endpoint.url, endpoint.name);
}
