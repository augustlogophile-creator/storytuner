// StoryTuner AI feedback endpoint (Vercel serverless function).
//
// The OpenAI key lives ONLY in process.env.OPENAI_API_KEY on the server.
// It is never sent to, or referenced by, the browser. The frontend POSTs a
// small JSON payload here; this function calls OpenAI and returns only the
// parsed result. If anything goes wrong the frontend falls back to its local
// heuristic scoring, so the app never gets stuck.
//
// Request body (one of):
//   { mode: "tell",  technique, prompt, model, answer }
//   { mode: "arena", transcript, seconds }
//
// Responses:
//   tell  -> { pass: bool, working: string, fix: string }
//   arena -> { hook: 0-100, climax: 0-100, landing: 0-100,
//              strongest: "hook"|"climax"|"landing", praise, fix }

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function clampScore(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return 60;
  return Math.max(0, Math.min(100, n));
}

async function callOpenAI(messages, key, { max_tokens = 400 } = {}) {
  // Race the request against a timeout so a slow model never hangs the UI.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error("OpenAI " + res.status + ": " + detail.slice(0, 300));
    }
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

// ---- prompt builders -------------------------------------------------------

function tellMessages({ technique, prompt, model, answer }) {
  const system =
    "You are Toro, a warm but honest storytelling coach inside a training app. " +
    "You judge whether a short written attempt demonstrates ONE specific storytelling technique. " +
    "You are encouraging but never dishonest: if the attempt does not show the technique, you say so and give one concrete fix. " +
    "Never give vague praise like 'nice job'. Always point at the actual words the person wrote. " +
    "The 'model example' is a reference for the standard, not something the user should copy; do not tell them to copy it. " +
    'Respond ONLY as strict JSON: {"pass": boolean, "working": string, "fix": string}. ' +
    "'working' is one sentence naming something real that already works in THEIR attempt (or, if nothing works, the most honest encouraging thing you can truthfully say). " +
    "'fix' is one specific, actionable sentence. If pass is true, 'fix' may be a small refinement. Keep each under 40 words. Do not use em dashes.";
  const user =
    "TECHNIQUE BEING TAUGHT:\n" + technique + "\n\n" +
    "THE PROMPT THE USER ANSWERED:\n" + prompt + "\n\n" +
    "A MODEL EXAMPLE (reference for the standard, not to be copied):\n" + model + "\n\n" +
    "WHAT THE USER WROTE:\n" + answer + "\n\n" +
    "Judge honestly whether their writing demonstrates the technique, then return the JSON.";
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function arenaMessages({ transcript, seconds }) {
  const system =
    "You are Toro, an honest storytelling coach. You grade a SPOKEN story (given as an auto-transcript, so ignore minor transcription errors) " +
    "on three dimensions, each 0 to 100, using these specific rules, not vibes:\n" +
    "HOOK: does it start inside the action rather than backstory, and are the stakes (what the narrator wants, fears, or risks losing) clear within the first couple of sentences?\n" +
    "CLIMAX: does tension escalate rather than stay flat; is there at least one concrete sensory or specific detail rather than vague description; is there honest uncertainty rather than false confidence?\n" +
    "LANDING: does the ending show a change rather than state a moral (e.g. 'that taught me'); does it land on a clear final beat instead of trailing off with filler like 'so yeah that's it'?\n" +
    "Score strictly and independently. A flat, vague, or trailing story should score low on the relevant dimension. " +
    "Then pick the single strongest dimension and write one specific piece of praise quoting or referencing their actual words, " +
    "and pick the single weakest dimension and write one specific, actionable fix referencing their actual words. " +
    'Respond ONLY as strict JSON: {"hook": number, "climax": number, "landing": number, "strongest": "hook"|"climax"|"landing", "praise": string, "fix": string}. ' +
    "Keep praise and fix under 45 words each. Never generic. Do not use em dashes.";
  const dur = seconds ? Math.round(seconds) : 0;
  const user =
    "SPOKEN STORY TRANSCRIPT (" + dur + " seconds):\n" +
    (transcript && transcript.trim() ? transcript.trim() : "(no transcript captured)") +
    "\n\nGrade it and return the JSON.";
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ---- handler ---------------------------------------------------------------

module.exports = async (req, res) => {
  // Basic CORS so the static frontend can call this from the same or another origin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }

  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(503).json({ error: "no_api_key" }); return; }

  let body = req.body;
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch (e) { body = null; }
  if (!body || typeof body !== "object") { res.status(400).json({ error: "bad_body" }); return; }

  try {
    if (body.mode === "tell") {
      const { technique = "", prompt = "", model = "", answer = "" } = body;
      if (!answer.trim()) { res.status(400).json({ error: "empty_answer" }); return; }
      const out = await callOpenAI(tellMessages({ technique, prompt, model, answer }), key, { max_tokens: 220 });
      res.status(200).json({
        pass: !!out.pass,
        working: String(out.working || "").slice(0, 300),
        fix: String(out.fix || "").slice(0, 300),
      });
      return;
    }

    if (body.mode === "arena") {
      const { transcript = "", seconds = 0 } = body;
      const out = await callOpenAI(arenaMessages({ transcript, seconds }), key, { max_tokens: 320 });
      const strongest = ["hook", "climax", "landing"].includes(out.strongest) ? out.strongest : "hook";
      res.status(200).json({
        hook: clampScore(out.hook),
        climax: clampScore(out.climax),
        landing: clampScore(out.landing),
        strongest,
        praise: String(out.praise || "").slice(0, 400),
        fix: String(out.fix || "").slice(0, 400),
      });
      return;
    }

    res.status(400).json({ error: "unknown_mode" });
  } catch (err) {
    // Signal failure clearly so the frontend uses its local heuristic fallback.
    res.status(502).json({ error: "upstream_failed", detail: String(err && err.message || err).slice(0, 300) });
  }
};
