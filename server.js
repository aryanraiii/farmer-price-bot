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

let lastDebug = { message: 'No requests yet' };

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

  if (body.object === 'whatsapp_business_account') {
    // Meta requires an immediate 200 OK response
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

            const { crop, district } = parse(messageBody);
            trackQuery(crop, district);

            let reply = getPrice(crop, district);
            const buyerInfo = findBuyers(crop, district);
            if (buyerInfo) {
              reply += buyerInfo;
            }

            // Clean up text
            const plainReply = reply.replace(/[^\x00-\x7F]/g, '').trim();

            console.log(`   Reply preview: ${plainReply.substring(0, 100)}...`);

            lastDebug = {
              timestamp: new Date().toISOString(),
              from, messageBody, parsed: { crop, district },
              replyPreview: plainReply.substring(0, 200)
            };

            // Send reply via Meta Cloud API
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
                    text: { body: reply } 
                  }
                });
                console.log(`   ✅ Meta Reply SENT! Message ID: ${response.data.messages[0].id}`);
                lastDebug.success = true;
                lastDebug.messageId = response.data.messages[0].id;
              } catch (error) {
                console.error(`   ❌ Meta SEND FAILED!`);
                console.error(`   Error details:`, error.response ? JSON.stringify(error.response.data) : error.message);
                lastDebug.success = false;
                lastDebug.error = error.response ? error.response.data : error.message;
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
    res.sendStatus(404);
  }
});

// ---------------------------------------------------------------------------
// GET /api/debug — See last webhook request + response
// ---------------------------------------------------------------------------
app.get('/api/debug', (req, res) => {
  res.json(lastDebug);
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
// POST /api/chat — Chat UI endpoint (reuses bot logic, no Twilio/Meta needed)
// ---------------------------------------------------------------------------
app.post('/api/chat', (req, res) => {
  const messageBody = (req.body.message || '').trim();
  if (!messageBody) {
    return res.json({ reply: 'Please type a crop and district, e.g. "onion nashik"' });
  }

  const { crop, district } = parse(messageBody);
  trackQuery(crop, district);

  let reply = getPrice(crop, district);
  const buyerInfo = findBuyers(crop, district);
  if (buyerInfo) reply += buyerInfo;

  console.log(`💬 Chat: "${messageBody}" → crop=${crop}, district=${district}`);
  res.json({ reply, parsed: { crop, district } });
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
});
