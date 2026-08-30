/**
 * parser.js — Extract crop name and district from free-text farmer messages.
 *
 * Handles variations like:
 *   "onion nashik"
 *   "price of tomato in pune"
 *   "wheat price nagpur"
 *   "green chilli kolhapur"
 *   "nashik onion rate"
 *
 * Crop and district lists are derived dynamically from prices.json
 * so adding new entries to the data file automatically extends recognition.
 */

const prices = require('./data/prices.json');

// ---------------------------------------------------------------------------
// Build unique crop and district lists dynamically from the data file.
// Multi-word crops (e.g. "green chilli") are kept intact.
// ---------------------------------------------------------------------------
const CROPS = [...new Set(prices.map((p) => p.crop.toLowerCase()))];
const DISTRICTS = [...new Set(prices.map((p) => p.district.toLowerCase()))];

// Sort multi-word entries first so "green chilli" matches before "green"
CROPS.sort((a, b) => b.length - a.length);
DISTRICTS.sort((a, b) => b.length - a.length);

/**
 * Parse a raw message string and return { crop, district } if found.
 *
 * Strategy:
 *  1. Normalise the input (lowercase, strip punctuation).
 *  2. Scan for the longest matching crop name.
 *  3. Scan for the longest matching district name.
 *  4. Return whatever was found (either or both may be null).
 *
 * @param  {string} text  Raw message body from the farmer
 * @return {{ crop: string|null, district: string|null }}
 */
function parse(text) {
  // Normalise: lowercase, collapse whitespace, strip common noise words
  const normalised = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')   // punctuation → space
    .replace(/\s+/g, ' ')       // collapse spaces
    .trim();

  let crop = null;
  let district = null;

  // Match the longest crop name found in the message
  for (const c of CROPS) {
    if (normalised.includes(c)) {
      crop = c;
      break; // CROPS is sorted longest-first, so first hit is best
    }
  }

  // Match the longest district name found in the message
  for (const d of DISTRICTS) {
    if (normalised.includes(d)) {
      district = d;
      break;
    }
  }

  return { crop, district };
}

module.exports = { parse, CROPS, DISTRICTS };
