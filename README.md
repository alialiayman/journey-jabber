# Journey Jabber 🌍🔊

A sleek React app that augments your trip in real time:
- ✨ **AI-normalized place names** (more culturally correct than raw geocoding)
- 🗣️ **Text-to-speech** announcements
- 🛣️ **Current street info**
- 🧭 **On-demand travel intel** (attractions, history, tips) — only when you click

---

## Features 🚀

- **AI City & Street Normalization** 🤖  
  From GPS → Google Geocode → OpenAI **`/api/normalize`** → culturally correct city endonym + English exonym (if different), and a cleaned street name.

- **Live City Announcements** 🗣️  
  Optionally speak the current city/street using the browser’s TTS.

- **On-Demand Travel Intel** 🧳  
  Click to fetch **nearby attractions, history, tips & don’t-miss** via **`/api/intel`** (no background fees until you ask).

- **Clean, responsive UI** 🧼  
  Material UI cards, tidy layout, and simple controls.

---

## Quick Start ⚡

```bash
# 1) Clone
git clone https://github.com/your-username/journey-jabber.git
cd journey-jabber

# 2) Install web app deps
npm install

# 3) Install Cloud Functions deps
cd functions
npm install
cd ..

# 4) Point Firebase CLI to your project
firebase use --add  # or: firebase use <YOUR_PROJECT_ID>

# 5) Set your OpenAI key as a Firebase Secret (server-side only)
firebase functions:secrets:set OPENAI_API_KEY --project <YOUR_PROJECT_ID>

# 6) Build & deploy (functions + hosting)
npm run build
firebase deploy --only functions:normalize,functions:travelIntel,hosting --project <YOUR_PROJECT_ID>
