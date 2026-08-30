/**
 * test.js — Simulate incoming messages to the /webhook/incoming endpoint.
 *
 * Usage:
 *   node test/test.js              — runs all built-in test cases
 *   node test/test.js "onion pune" — runs a single custom message
 *
 * This script sends POST requests that mimic Twilio's webhook payload,
 * so you can test the full pipeline without a Twilio account.
 */

const http = require('http');
const querystring = require('querystring');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ---- Test cases ----
const TEST_MESSAGES = [
  // Standard format
  'onion nashik',
  'tomato pune',
  'potato nagpur',

  // Natural language variations
  'price of tomato in pune',
  'what is the rate of garlic in nashik',
  'green chilli kolhapur',

  // Partial queries (crop only, district only)
  'onion',
  'nashik',

  // Unknown crop
  'wheat price nagpur',

  // Gibberish
  'hello bot',

  // Mixed case
  'CABBAGE AURANGABAD',

  // Buyer match expected
  'garlic nashik',
];

/**
 * Send a POST request to /webhook/incoming simulating a Twilio payload.
 * @param  {string} message  The message body
 * @return {Promise<string>} The response body
 */
function sendTestMessage(message) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      Body: message,
      From: 'whatsapp:+919999999999',
      To: 'whatsapp:+14155238886',
      MessageSid: 'TEST_' + Date.now(),
    });

    const url = new URL('/webhook/incoming', BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  // Allow a custom single message via CLI args
  const messages = process.argv[2] ? [process.argv.slice(2).join(' ')] : TEST_MESSAGES;

  console.log('='.repeat(60));
  console.log(' Farmer Mandi Price Bot — Test Runner');
  console.log('='.repeat(60));
  console.log(`Sending ${messages.length} test message(s) to ${BASE_URL}/webhook/incoming\n`);

  for (const msg of messages) {
    console.log(`─── Sending: "${msg}" ───`);
    try {
      const { status } = await sendTestMessage(msg);
      console.log(`    HTTP ${status} ✅`);
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
    }
    console.log();
  }

  // Fetch and display stats
  console.log('─── Fetching /api/stats ───');
  try {
    const res = await new Promise((resolve, reject) => {
      http.get(`${BASE_URL}/api/stats`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }

  console.log('\n✅ Test run complete.');
}

runTests();
