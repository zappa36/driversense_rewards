// ============================================================
// Otto voice debrief — Supabase Edge Function.
//
// The People Mobile app records a short voice clip ("the elevator is
// broken", "the road is closed") and posts it here. This function:
//   1. transcribes the clip with OpenAI speech-to-text,
//   2. asks a small model to structure it into a shareable tip and a
//      short spoken-style reply from Otto,
//   3. returns { transcript, reply, tip: { title, category } }.
//
// The OpenAI key lives ONLY in this function's secrets — it is never
// shipped to the browser or committed to the repo. Set it once:
//   Dashboard → Edge Functions → Secrets → add OPENAI_API_KEY
//   (or CLI: supabase secrets set OPENAI_API_KEY=sk-...)
// ============================================================

const ALLOW_ORIGINS = [
  'https://zappa36.github.io',
  'http://localhost:8000',
  'http://localhost:4180',
];

const CATEGORIES = ['ACCESS', 'CLOSURE', 'HAZARD', 'ENTRANCE', 'HOURS', 'INFO'];

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };
  const fail = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail(405, 'POST only');
  // Same spirit as the referrer-locked Maps key: only the app's own pages.
  if (!origin || !ALLOW_ORIGINS.includes(origin)) return fail(403, 'origin not allowed');

  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return fail(500, 'OPENAI_API_KEY secret is not set');

  try {
    const form = await req.formData();
    const audio = form.get('audio');
    const place = String(form.get('place') || 'this place').slice(0, 120);
    if (!(audio instanceof File)) return fail(400, 'no audio clip');
    if (audio.size > 8_000_000) return fail(413, 'clip too long — keep it under ~60 seconds');

    // 1) speech -> text
    const tf = new FormData();
    tf.append('file', audio, audio.name || 'clip.webm');
    tf.append('model', 'gpt-4o-mini-transcribe'); // 'whisper-1' also works here
    const tr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: tf,
    });
    if (!tr.ok) return fail(502, `transcription failed: ${(await tr.text()).slice(0, 300)}`);
    const transcript = String((await tr.json()).text || '').trim();
    if (!transcript) return fail(422, 'heard nothing — try again closer to the mic');

    // 2) structure the observation + Otto's reply
    const cr = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'You are Otto, the friendly field assistant in a city-data app. ' +
              'People speak short observations about a place (broken elevator, closed road, moved entrance, opening hours...). ' +
              'Return ONLY JSON: {"reply": string, "tip": {"title": string, "category": string}}. ' +
              'reply: one warm spoken-style sentence acknowledging what they said, plus at most one short follow-up question if something useful is missing. ' +
              'tip.title: an actionable summary for the next visitor, max 60 characters, e.g. "Elevator broken — take the stairs". ' +
              `tip.category: exactly one of ${CATEGORIES.join(', ')}.`,
          },
          { role: 'user', content: `Place: ${place}\nTranscribed voice note: "${transcript}"` },
        ],
      }),
    });
    if (!cr.ok) return fail(502, `structuring failed: ${(await cr.text()).slice(0, 300)}`);
    let reply = 'Noted — saved for the next visitor.';
    let tip = { title: transcript.slice(0, 60), category: 'INFO' };
    try {
      const parsed = JSON.parse((await cr.json()).choices[0].message.content);
      if (parsed.reply) reply = String(parsed.reply).slice(0, 300);
      if (parsed.tip && parsed.tip.title) {
        tip = {
          title: String(parsed.tip.title).slice(0, 60),
          category: CATEGORIES.includes(parsed.tip.category) ? parsed.tip.category : 'INFO',
        };
      }
    } catch { /* keep the safe defaults */ }

    return new Response(JSON.stringify({ transcript, reply, tip }), { headers });
  } catch (e) {
    return fail(500, `unexpected: ${String(e).slice(0, 200)}`);
  }
});
