/**
 * server.js — Express server for the Farmer Mandi Price Bot (Meta WhatsApp Cloud API).
 *
 * Routes:
 *   GET  /webhook          — Meta webhook verification (hub.challenge)
 *   POST /webhook          — Receives incoming WhatsApp messages from Meta
 *   GET  /api/stats        — In-memory usage statistics (JSON)
 *   GET  /                 — Dashboard UI (serves public/index.html)
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const { parse } = require('./parser');
const { getPrice } = require('./priceEngine');
const { findBuyers } = require('./matcher');

const app = express();
const PORT = process.env.PORT || 3000;

// Meta WhatsApp Cloud API credentials
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'my_secret_verify_token_123';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

// Middleware
app.use(express.json()); // Meta sends JSON, not URL-encoded
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// In-memory stats tracking
// ---------------------------------------------------------------------------
const stats = {
  totalMessages: 0,
  cropCounts: {},
  districtCounts: {},
};

function trackQuery(crop, district) {
  stats.totalMessages++;
  if (crop) stats.cropCounts[crop] = (stats.cropCounts[crop] || 0) + 1;
  if (district) stats.districtCounts[district] = (stats.districtCounts[district] || 0) + 1;
}

function topKey(obj) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return 'N/A';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

// ---------------------------------------------------------------------------
// GET /webhook — Webhook Verification (Required by Meta)
// ---------------------------------------------------------------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      console.log('✅ Meta Webhook Verified');
      res.status(200).send(challenge);
    } else {
      console.error('❌ Meta Webhook Verification Failed: Tokens do not match');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// ---------------------------------------------------------------------------
// POST /webhook — Receive Messages from Meta
// ---------------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Check if it's a WhatsApp webhook event
  if (body.object === 'whatsapp_business_account') {
    // Meta sends a 200 OK immediately to acknowledge receipt
    res.sendStatus(200);

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Ensure this is an actual text message and not a status update (read/delivered)
        if (value && value.messages && value.messages[0]) {
          const message = value.messages[0];
          
          if (message.type === 'text') {
            const from = message.from; // Sender's phone number
            const messageBody = message.text.body;

            console.log('━'.repeat(60));
            console.log(`📩 Message from ${from}: "${messageBody}"`);

            // 1. Parse the message to extract crop + district
            const { crop, district } = parse(messageBody);
            console.log(`   Parsed → crop: ${crop}, district: ${district}`);

            // 2. Track for stats
            trackQuery(crop, district);

            // 3. Look up price and build reply
            let reply = getPrice(crop, district);

            // 4. Append buyer matches if available
            const buyerInfo = findBuyers(crop, district);
            if (buyerInfo) {
              reply += buyerInfo;
            }

            // Strip formatting that might cause issues in testing
            const plainReply = reply
              .replace(/[^\x00-\x7F]/g, '')
              .trim();

            console.log(`   Reply preview: ${plainReply.substring(0, 100)}...`);

            // 5. Send reply via Meta Cloud API
            if (META_ACCESS_TOKEN && META_PHONE_NUMBER_ID) {
              try {
                const response = await axios({
                  method: 'POST',
                  url: `https://graph.facebook.com/v17.0/${META_PHONE_NUMBER_ID}/messages`,
                  headers: {
                    'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  data: {
                    messaging_product: 'whatsapp',
                    to: from,
                    type: 'text',
                    text: { body: reply } // Meta handles markdown natively
                  }
                });
                console.log(`   ✅ Meta Reply SENT! Message ID: ${response.data.messages[0].id}`);
              } catch (error) {
                console.error(`   ❌ Meta SEND FAILED!`);
                console.error(`   Error details:`, error.response ? error.response.data : error.message);
              }
            } else {
              console.log('   ⚠️  Meta credentials MISSING — reply logged only');
            }
            console.log('━'.repeat(60));
          }
        }
      }
    }
  } else {
    // Return a '404 Not Found' if event is not from a WhatsApp API
    res.sendStatus(404);
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats — Usage statistics
// ---------------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  res.json({
    totalMessages: stats.totalMessages,
    mostQueriedCrop: topKey(stats.cropCounts),
    mostQueriedDistrict: topKey(stats.districtCounts),
    cropCounts: stats.cropCounts,
    districtCounts: stats.districtCounts,
  });
});

// ---------------------------------------------------------------------------
// GET /api/test-reply — Quick test endpoint
// ---------------------------------------------------------------------------
app.get('/api/test-reply', (req, res) => {
  const message = req.query.message || '';
  const { crop, district } = parse(message);
  trackQuery(crop, district);

  let reply = getPrice(crop, district);
  const buyerInfo = findBuyers(crop, district);
  if (buyerInfo) reply += buyerInfo;

  res.json({ input: message, parsed: { crop, district }, reply });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Farmer Mandi Price Bot (Meta API) running on http://localhost:${PORT}`);
  console.log(`   Webhook Verification URL: GET  http://localhost:${PORT}/webhook`);
  console.log(`   Webhook Incoming Msg URL: POST http://localhost:${PORT}/webhook`);
  console.log(`   Dashboard:                GET  http://localhost:${PORT}/`);
  console.log(`   Test:                     GET  http://localhost:${PORT}/api/test-reply?message=onion+nashik\n`);
});
