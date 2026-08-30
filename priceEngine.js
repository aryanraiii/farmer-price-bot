/**
 * priceEngine.js — Look up mandi prices and build a human-friendly reply.
 *
 * Price data source: real Agmarknet Maharashtra daily modal prices,
 * aggregated to weekly averages per district.
 *
 * Given a crop + district, this module:
 *  1. Finds the matching entry in prices.json.
 *  2. Computes the week-over-week % change.
 *  3. Returns a formatted message with price, trend, and actionable advice.
 */

const prices = require('./data/prices.json');
const { CROPS, DISTRICTS } = require('./parser');

/**
 * Capitalise the first letter of each word (for display).
 * @param  {string} str
 * @return {string}
 */
function titleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Look up the price for a crop+district and return a formatted reply string.
 *
 * @param  {string|null} crop     Normalised crop name (lowercase)
 * @param  {string|null} district Normalised district name (lowercase)
 * @return {string}               Human-readable reply
 */
function getPrice(crop, district) {
  // ---- Neither crop nor district provided ----
  if (!crop && !district) {
    return buildHelpMessage();
  }

  // ---- Only crop provided ----
  if (crop && !district) {
    return (
      `I found the crop "${titleCase(crop)}" but couldn't identify the district.\n\n` +
      `Please include a district name, e.g.:\n` +
      `"${crop} nashik" or "${crop} pune"\n\n` +
      `Available districts: ${DISTRICTS.map(titleCase).join(', ')}`
    );
  }

  // ---- Only district provided ----
  if (!crop && district) {
    return (
      `I found the district "${titleCase(district)}" but couldn't identify the crop.\n\n` +
      `Please include a crop name, e.g.:\n` +
      `"onion ${district}" or "tomato ${district}"\n\n` +
      `Available crops: ${CROPS.map(titleCase).join(', ')}`
    );
  }

  // ---- Both provided — look up the price ----
  const entry = prices.find(
    (p) => p.crop.toLowerCase() === crop && p.district.toLowerCase() === district
  );

  if (!entry) {
    return (
      `Sorry, I don't have price data for ${titleCase(crop)} in ${titleCase(district)}.\n\n` +
      `Try one of these:\n` +
      `• onion nashik\n• tomato pune\n• potato nagpur\n\n` +
      `Available crops: ${CROPS.map(titleCase).join(', ')}\n` +
      `Available districts: ${DISTRICTS.map(titleCase).join(', ')}`
    );
  }

  return formatPriceReply(entry);
}

/**
 * Build the formatted price reply for a matched entry.
 * Includes price, % change, trend direction, and actionable advice.
 *
 * @param  {Object} entry  A single entry from prices.json
 * @return {string}
 */
function formatPriceReply(entry) {
  const { crop, district, priceThisWeek, priceLastWeek, unit, weekEnding, source } = entry;

  const change = priceThisWeek - priceLastWeek;
  const pctChange = ((change / priceLastWeek) * 100).toFixed(1);
  const absPct = Math.abs(pctChange);

  let direction, advice;

  if (change > 0) {
    direction = `up ${absPct}%`;
    advice = '📈 Good time to sell — prices are trending up this week.';
  } else if (change < 0) {
    direction = `down ${absPct}%`;
    advice = '📉 Prices dropped this week — hold if you can store it.';
  } else {
    direction = 'unchanged';
    advice = '➡️ Prices are stable — sell based on your storage capacity.';
  }

  return (
    `🌾 *${titleCase(crop)} in ${titleCase(district)}*\n` +
    `Rs ${priceThisWeek}/${unit} (${direction} from Rs ${priceLastWeek} last week)\n` +
    `Week ending: ${weekEnding}\n\n` +
    `${advice}\n\n` +
    `_Source: ${source}_`
  );
}

/**
 * Generic help message when we can't parse anything useful.
 * @return {string}
 */
function buildHelpMessage() {
  // Pick 2-3 example crops from the actual data
  const examples = CROPS.slice(0, 3).map(titleCase);
  return (
    `🙏 Welcome to *Mandi Price Bot*!\n\n` +
    `Send me a crop name and district to get the latest APMC price.\n\n` +
    `Examples:\n` +
    `• "onion nashik"\n` +
    `• "price of tomato in pune"\n` +
    `• "potato nagpur"\n\n` +
    `Available crops: ${examples.join(', ')} and more.\n` +
    `Available districts: ${DISTRICTS.map(titleCase).join(', ')}`
  );
}

module.exports = { getPrice, titleCase };
