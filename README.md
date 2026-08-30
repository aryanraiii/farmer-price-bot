# Farmer Mandi Price Bot 🌾

A WhatsApp/SMS bot that gives Indian farmers real-time APMC mandi prices for Maharashtra. Farmers text a crop name and district (e.g., "onion nashik") and receive the latest weekly price, trend vs last week, and actionable advice.

## Features

- **Price lookup** — Current mandi prices for 8 crops across 5 Maharashtra districts
- **Trend analysis** — Week-over-week % change with buy/sell advice
- **Buyer matching** — Connects farmers with buyers looking for their crop in their district
- **Live dashboard** — Real-time stats with Chart.js visualisations
- **Test panel** — Try messages directly from the dashboard, no Twilio needed

## Tech Stack

- **Node.js + Express** — Backend server
- **Twilio** — WhatsApp/SMS messaging
- **Chart.js** — Dashboard charts (via CDN)
- **Static JSON** — Price and buyer data (no database needed)

---

## Quick Start

### 1. Install dependencies

```bash
git clone <repo-url> && cd farmer-price-bot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Twilio credentials (optional for local testing)
```

### 3. Run the server

```bash
npm start
# or for development (auto-restart on file changes):
npm run dev
```

The server starts at **http://localhost:3000**.

### 4. Test without Twilio

**Option A — Use the dashboard test panel:**
Open http://localhost:3000 and use the "Quick Test" panel at the bottom.

**Option B — Run the test script:**
```bash
# Start the server first, then in another terminal:
npm test
```

**Option C — Use curl:**
```bash
# Simulate a Twilio webhook POST
curl -X POST http://localhost:3000/webhook/incoming \
  -d "Body=onion nashik" \
  -d "From=whatsapp:+919999999999"

# Or use the test-reply GET endpoint for quick checks
curl "http://localhost:3000/api/test-reply?message=onion+nashik"

# Check stats
curl http://localhost:3000/api/stats
```

---

## Twilio WhatsApp Sandbox Setup

1. **Create a Twilio account** at https://twilio.com (free trial works).

2. **Activate the WhatsApp Sandbox:**
   - Go to **Messaging → Try it out → Send a WhatsApp message**
   - Follow the instructions to join the sandbox (send "join <your-keyword>" to the sandbox number)

3. **Get your credentials:**
   - **Account SID** and **Auth Token** from the [Twilio Console](https://console.twilio.com)
   - **WhatsApp Sandbox number** — usually `whatsapp:+14155238886`

4. **Add credentials to `.env`:**
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

5. **Expose your local server with ngrok:**
   ```bash
   ngrok http 3000
   ```

6. **Set the webhook URL in Twilio:**
   - Go to **Messaging → Settings → WhatsApp Sandbox Settings**
   - Set "When a message comes in" to: `https://<your-ngrok-id>.ngrok.io/webhook/incoming`
   - Method: **POST**

7. **Send a WhatsApp message** to the sandbox number — e.g., "onion nashik" — and you should get a reply!

---

## API Endpoints

| Method | Path                | Description                              |
|--------|---------------------|------------------------------------------|
| POST   | `/webhook/incoming` | Twilio webhook — receives incoming msgs  |
| GET    | `/api/stats`        | Usage stats JSON                         |
| GET    | `/api/test-reply`   | Test a message (query param: `?message=`)| 
| GET    | `/`                 | Dashboard UI                             |

---

## Project Structure

```
farmer-price-bot/
├── server.js          # Express app + routes + Twilio integration
├── parser.js          # Extract crop + district from free text
├── priceEngine.js     # Price lookup, trend calc, reply formatting
├── matcher.js         # Match farmer queries to buyer demand
├── data/
│   ├── prices.json    # Agmarknet Maharashtra mandi prices
│   └── buyers.json    # Buyer demand entries
├── public/
│   └── index.html     # Dashboard with Chart.js
├── test/
│   └── test.js        # Automated test script
├── .env.example       # Environment variable template
├── package.json
└── README.md
```

## Supported Crops & Districts

**Crops:** Onion, Tomato, Potato, Cabbage, Cauliflower, Brinjal, Garlic, Green Chilli

**Districts:** Nashik, Pune, Nagpur, Kolhapur, Aurangabad

---

## License

MIT
