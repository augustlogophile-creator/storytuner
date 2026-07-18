import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPublishableKey() {
  const currentKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (currentKeys) {
    try {
      const parsed = JSON.parse(currentKeys);
      if (typeof parsed?.default === "string" && parsed.default.length > 0) return parsed.default;
    } catch {
      // Fall through to the legacy anon key when the value is unavailable or malformed.
    }
  }

  const legacyKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!legacyKey) throw new Error("Supabase publishable key is unavailable.");
  return legacyKey;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let recordingId: string | null = null;
  let userClient: ReturnType<typeof createClient> | null = null;

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "You must be logged in." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is unavailable.");
    if (!openAIKey) throw new Error("OPENAI_API_KEY is unavailable.");

    userClient = createClient(supabaseUrl, getPublishableKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Your login session is invalid." }, 401);

    const requestBody = await request.json();
    recordingId = typeof requestBody?.recordingId === "string" ? requestBody.recordingId : null;
    if (!recordingId) return jsonResponse({ error: "A recordingId is required." }, 400);

    const { data: recording, error: recordingError } = await userClient
      .from("recording_uploads")
      .select("id, user_id, storage_path, content_type, status, transcript")
      .eq("id", recordingId)
      .single();

    if (recordingError || !recording) return jsonResponse({ error: "Recording not found." }, 404);
    if (recording.user_id !== user.id) return jsonResponse({ error: "You cannot access this recording." }, 403);

    if (recording.status === "ready" && recording.transcript) {
      return jsonResponse({ recordingId, transcript: recording.transcript, status: "ready" });
    }

    const { error: statusError } = await userClient
      .from("recording_uploads")
      .update({ status: "transcribing", error_message: null })
      .eq("id", recordingId);
    if (statusError) throw new Error(`Could not update recording status: ${statusError.message}`);

    const { data: audioBlob, error: downloadError } = await userClient.storage
      .from("storytuner-recordings")
      .download(recording.storage_path);
    if (downloadError || !audioBlob) throw new Error(`Could not download recording: ${downloadError?.message ?? "File unavailable"}`);
    if (audioBlob.size > 24 * 1024 * 1024) throw new Error("This audio file is too large to transcribe. The maximum is 24 MB.");

    const fileName = recording.storage_path.split("/").pop() || "recording.webm";
    const contentType = recording.content_type || audioBlob.type || "audio/webm";
    const audioFile = new File([audioBlob], fileName, { type: contentType });
    const transcriptionForm = new FormData();
    transcriptionForm.append("file", audioFile);
    transcriptionForm.append("model", "gpt-4o-mini-transcribe");

    const openAIResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIKey}` },
      body: transcriptionForm,
    });

    if (!openAIResponse.ok) {
      const errorDetails = await openAIResponse.text();
      throw new Error(`OpenAI transcription failed (${openAIResponse.status}): ${errorDetails.slice(0, 500)}`);
    }

    const transcriptionResult = await openAIResponse.json();
    const transcript = typeof transcriptionResult?.text === "string" ? transcriptionResult.text.trim() : "";
    if (!transcript) throw new Error("OpenAI returned an empty transcript.");

    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const title = titleFrom(transcript);
    const { error: saveError } = await userClient
      .from("recording_uploads")
      .update({ status: "ready", transcript, title, word_count: wordCount, error_message: null })
      .eq("id", recordingId);
    if (saveError) throw new Error(`Could not save transcript: ${saveError.message}`);

    return jsonResponse({ recordingId, transcript, title, wordCount, status: "ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown transcription error.";
    if (userClient && recordingId) {
      await userClient.from("recording_uploads").update({ status: "failed", error_message: message.slice(0, 500) }).eq("id", recordingId);
    }
    console.error("Transcription error:", message);
    return jsonResponse({ error: "Transcription failed.", details: message }, 500);
  }
});

function titleFrom(text: string) {
  const sentence = text.split(/[.!?]/)[0]?.trim() || text.trim();
  const words = sentence.replace(/[^\w'’ -]/g, " ").split(/\s+/).filter(Boolean).slice(0, 7);
  return words.length ? words.join(" ") : "Untitled story";
}
