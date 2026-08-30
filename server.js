/**
 * server.js — Express server for the Farmer Mandi Price Bot (Kapso SDK).
 *
 * Routes:
 *   GET  /webhook          — Kapso/Meta webhook verification
 *   POST /webhook          — Receives incoming WhatsApp messages
 *   GET  /api/stats        — In-memory usage statistics (JSON)
 *   GET  /                 — Dashboard UI (serves public/index.html)
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { WhatsAppClient } = require('@kapso/whatsapp-cloud-api');
const { parse } = require('./parser');
const { getPrice } = require('./priceEngine');
const { findBuyers } = require('./matcher');

const app = express();
const PORT = process.env.PORT || 3000;

// Kapso API Client
const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const client = new WhatsAppClient({
  baseUrl: 'https://api.kapso.ai/meta/whatsapp', // Use Kapso Proxy
  kapsoApiKey: KAPSO_API_KEY,
});

// Middleware
app.use(express.json());
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
// GET /webhook — Webhook Verification
// ---------------------------------------------------------------------------
app.get('/webhook', (req, res) => {
  const challenge = req.query['hub.challenge'];
  res.status(200).send(challenge || 'OK');
});

// ---------------------------------------------------------------------------
// POST /webhook — Receive Messages from Kapso
// ---------------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  // Acknowledge receipt within 10s
  res.sendStatus(200);

  try {
    const isBatch = req.headers['x-webhook-batch'] === 'true' || req.body.batch === true;
    const payloads = isBatch ? req.body.data : [req.body];

    for (const payload of payloads) {
      // Check if it's a standard Meta format payload
      if (payload.object === 'whatsapp_business_account') {
        for (const entry of payload.entry) {
          for (const change of entry.changes) {
            const value = change.value;
            
            // Check for a text message
            if (value && value.messages && value.messages[0]) {
              const message = value.messages[0];
              
              if (message.type === 'text') {
                const from = message.from;
                const messageBody = message.text.body;

                console.log('━'.repeat(60));
                console.log(`📩 Message from ${from}: "${messageBody}"`);

                const { crop, district } = parse(messageBody);
                trackQuery(crop, district);

                let reply = getPrice(crop, district);
                const buyerInfo = findBuyers(crop, district);
                if (buyerInfo) reply += buyerInfo;

                // Send reply via Kapso SDK
                if (KAPSO_API_KEY && PHONE_NUMBER_ID) {
                  try {
                    await client.messages.sendText({
                      phoneNumberId: PHONE_NUMBER_ID,
                      to: from,
                      body: reply
                    });
                    console.log('   ✅ Kapso Reply SENT!');
                  } catch (error) {
                    console.error('   ❌ Kapso SEND FAILED:', error.message);
                  }
                } else {
                  console.log('   ⚠️  Kapso credentials MISSING — reply logged only');
                }
                console.log('━'.repeat(60));
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error processing webhook:', err);
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
  console.log(`\n🚀 Farmer Mandi Price Bot (Kapso API) running on http://localhost:${PORT}`);
});
