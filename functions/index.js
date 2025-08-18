// --- add these imports at top of file (if not already present) ---
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import logger from "firebase-functions/logger";

// keep your existing OPENAI secret
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

function cors(req, res) {
    // Safe even with Hosting rewrites, and helpful if you call direct
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") { res.status(204).send(""); return true; }
    return false;
}

function extractJson(text) {
    try {
        const s = text.indexOf("{");
        const e = text.lastIndexOf("}");
        if (s >= 0 && e >= 0) return JSON.parse(text.slice(s, e + 1));
    } catch {
        // Ignore JSON parse errors, return null
        logger.warn("Failed to parse JSON from text", text);
    }
    return null;
}

export const normalize = onRequest(
    {region: "us-central1", timeoutSeconds: 120, memory: "512MiB", secrets: [OPENAI_API_KEY]},
    async (req, res) => {
        if (cors(req, res)) return;
        try {
            if (req.method !== "POST") return res.status(405).json({error: "POST only"});

            const key = OPENAI_API_KEY.value?.() || process.env.OPENAI_API_KEY;
            if (!key) return res.status(500).json({error: "Missing OPENAI_API_KEY"});

            const {
                lat, lng,
                rawCity,          // locality/sublocality candidate from client (e.g., "Saint-Denis")
                rawStreet,        // e.g., "Rue Gabriel Péri"
                country,          // e.g., "France"
                admin2,           // e.g., "Seine-Saint-Denis"
                parentCityHint,   // e.g., "Paris" (optional display suffix)
                model = "gpt-4o-mini",
            } = req.body || {};

            if (typeof lat !== "number" || typeof lng !== "number") {
                return res.status(400).json({error: "lat and lng must be numbers"});
            }

            const {default: OpenAI} = await import("openai");
            const client = new OpenAI({apiKey: key});

            const instruction = `
You are a toponymy expert. Choose the SMALLEST inhabited unit (town/commune/city-district/arrondissement/sublocality)
that contains the GPS point. Do NOT replace a suburb/commune with a larger metro name (e.g., don't output "Paris" if
the locality is "Saint-Denis").

Rules (strict):
- Prefer "locality"; if absent, prefer "sublocality_*"; else use the smallest human settlement label available.
- Keep endonym spelling and diacritics correctly (e.g., "Saint-Denis").
- Street: clean capitalization and spacing; if unsure, keep as given.
- If a parent city hint is provided, also return "display_city" formatted "<locality>, <parent>".

Inputs:
- rawCity (locality candidate): ${rawCity || "(unknown)"}
- admin2 (dept/prefecture): ${admin2 || "(unknown)"}
- parentCityHint: ${parentCityHint || "(none)"}
- Country: ${country || "(unknown)"}
- GPS: (${lat}, ${lng})
- Street: ${rawStreet || "(unknown)"}

Return ONLY compact JSON:
{"city":"<locality>","city_english":"<english or same>","street":"<cleaned street>","display_city":"<locality[, parent]>"}
`.trim();

            const completion = await client.chat.completions.create({
                model,
                messages: [
                    {role: "system", content: instruction},
                    {role: "user", content: "Return JSON only."},
                ],
            });

            const text = completion.choices[0]?.message?.content || "";
            const parsed = extractJson(text) || {};

            const baseCity = parsed.city || rawCity || "";
            const displayCity = parsed.display_city || (parentCityHint ? `${baseCity}, ${parentCityHint}` : baseCity);

            return res.json({
                city: baseCity,
                city_english: parsed.city_english || baseCity,
                street: parsed.street || rawStreet || "",
                display_city: displayCity,
                raw: text,
            });
        } catch (e) {
            logger.error("normalize error", e);
            return res.status(500).json({error: e?.message || "Server error"});
        }
    },
);
