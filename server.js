/**
 * server.js — Express server for the Farmer Mandi Price Bot.
 *
 * Routes:
 *   POST /webhook/incoming  — Twilio webhook for incoming WhatsApp/SMS messages
 *   GET  /api/stats          — In-memory usage statistics (JSON)
 *   GET  /                   — Dashboard UI (serves public/index.html)
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { parse } = require('./parser');
const { getPrice } = require('./priceEngine');
const { findBuyers } = require('./matcher');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.urlencoded({ extended: false }));
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

// Store last request/response for debugging via /api/debug
let lastDebug = { message: 'No requests yet' };

// ---------------------------------------------------------------------------
// POST /webhook/incoming — Twilio incoming message handler
// ---------------------------------------------------------------------------
app.post('/webhook/incoming', (req, res) => {
  const messageBody = req.body.Body || '';
  const from = req.body.From || 'unknown';

  console.log('━'.repeat(60));
  console.log(`📩 Message from ${from}: "${messageBody}"`);
  console.log(`   Full body:`, JSON.stringify(req.body));

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

  // Strip emoji + markdown for WhatsApp sandbox compatibility
  const plainReply = reply
    .replace(/[^\x00-\x7F]/g, '')   // remove non-ASCII (emoji)
    .replace(/\*/g, '')              // remove bold markdown
    .replace(/_/g, '')               // remove italic markdown
    .trim();

  console.log(`   Plain reply: ${plainReply.substring(0, 120)}...`);

  // 5. Reply via TwiML inline response.
  const { MessagingResponse } = require('twilio').twiml;
  const twiml = new MessagingResponse();
  twiml.message(plainReply);

  const twimlStr = twiml.toString();
  console.log(`   TwiML: ${twimlStr}`);
  console.log('   ✅ Sending TwiML reply');
  console.log('━'.repeat(60));

  lastDebug = {
    timestamp: new Date().toISOString(),
    from, messageBody, parsed: { crop, district },
    replyPreview: plainReply.substring(0, 200),
    twiml: twimlStr,
    success: true,
  };

  res.set('Content-Type', 'text/xml');
  res.send(twimlStr);
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
  console.log(`\n🚀 Farmer Mandi Price Bot running on http://localhost:${PORT}`);
  console.log(`   Webhook URL: POST http://localhost:${PORT}/webhook/incoming`);
  console.log(`   Dashboard:   GET  http://localhost:${PORT}/`);
  console.log(`   Stats API:   GET  http://localhost:${PORT}/api/stats`);
  console.log(`   Test:        GET  http://localhost:${PORT}/api/test-reply?message=onion+nashik\n`);
});
