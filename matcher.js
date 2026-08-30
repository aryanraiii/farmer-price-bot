/**
 * matcher.js — Match a farmer's crop+district query against buyers.json.
 *
 * If a buyer is looking for the same crop in the same district,
 * we append their info to the reply so the farmer can connect directly.
 */

const buyers = require('./data/buyers.json');
const { titleCase } = require('./priceEngine');

/**
 * Find buyers interested in a given crop+district combination.
 *
 * @param  {string|null} crop     Normalised crop name (lowercase)
 * @param  {string|null} district Normalised district name (lowercase)
 * @return {string}               Buyer info string to append, or empty string
 */
function findBuyers(crop, district) {
  if (!crop || !district) return '';

  const matches = buyers.filter(
    (b) => b.crop.toLowerCase() === crop && b.district.toLowerCase() === district
  );

  if (matches.length === 0) return '';

  // Build a buyer info block for each match
  const lines = matches.map((b) => {
    return (
      `🤝 *Buyer interested:* ${b.buyerName} needs ${b.quantityNeeded} ` +
      `of ${titleCase(b.crop)}, contact ${b.contact}`
    );
  });

  return '\n\n--- Buyer Matches ---\n' + lines.join('\n');
}

module.exports = { findBuyers };
