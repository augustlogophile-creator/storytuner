import { createClient } from "npm:@supabase/supabase-js@2";


const MAX_RECORDING_BYTES = 24 * 1024 * 1024;
const ALLOWED_RECORDING_MIME_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"]);

function normalizedAudioMime(value: unknown) {
  const base = typeof value === "string" ? value.toLowerCase().split(";", 1)[0].trim() : "";
  return ALLOWED_RECORDING_MIME_TYPES.has(base) ? base : null;
}

function audioSignatureMatches(bytes: Uint8Array, mime: string) {
  const ascii = (start: number, length: number) => {
    if (bytes.length < start + length) return "";
    let result = "";
    for (let index = start; index < start + length; index += 1) result += String.fromCharCode(bytes[index]);
    return result;
  };
  if (mime === "audio/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (mime === "audio/ogg") return ascii(0, 4) === "OggS";
  if (mime === "audio/wav" || mime === "audio/x-wav") return bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE";
  if (mime === "audio/mp4") return bytes.length >= 8 && ascii(4, 4) === "ftyp";
  if (mime === "audio/mpeg") return ascii(0, 3) === "ID3" || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  return false;
}

function safeExtensionForMime(mime: string) {
  if (mime === "audio/ogg") return "ogg";
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/mp4") return "m4a";
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  return "webm";
}

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://storytuner.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function allowedOrigins() {
  const configured = (Deno.env.get("STORYTUNER_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function corsHeadersFor(request: Request) {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function browserOriginAllowed(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || allowedOrigins().has(origin);
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(request), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}


function edgeLog(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ source: "storytuner-edge", event, at: new Date().toISOString(), ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
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
  if (request.method === "OPTIONS") {
    if (!browserOriginAllowed(request)) return new Response("Forbidden", { status: 403, headers: { "Vary": "Origin" } });
    return new Response("ok", { headers: corsHeadersFor(request) });
  }
  if (!browserOriginAllowed(request)) return jsonResponse(request, { error: "Cross-origin request blocked." }, 403);
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed." }, 405);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 10_000) return jsonResponse(request, { error: "Request is too large." }, 413);

  let recordingId: string | null = null;
  let userClient: ReturnType<typeof createClient> | null = null;
  let adminClient: ReturnType<typeof createClient> | null = null;
  let userId: string | null = null;
  let usageReservedNow = false;

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return jsonResponse(request, { error: "You must be logged in." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is unavailable.");
    if (!openAIKey) throw new Error("OPENAI_API_KEY is unavailable.");

    userClient = createClient(supabaseUrl, getPublishableKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse(request, { error: "Your login session is invalid." }, 401);
    userId = user.id;

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is unavailable.");
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    {
      const { data: moderation, error: moderationError } = await adminClient
        .from("community_moderation_status")
        .select("account_status, account_suspended_until, public_message")
        .eq("user_id", user.id)
        .maybeSingle();

      if (moderationError) {
        edgeLog("error", "transcription_restriction_lookup_failed", { userId: user.id, message: moderationError.message.slice(0, 500) });
      } else if (moderation) {
        const suspendedUntil = moderation.account_suspended_until
          ? new Date(moderation.account_suspended_until).getTime()
          : null;
        const activelySuspended = moderation.account_status === "suspended"
          && (suspendedUntil === null || suspendedUntil > Date.now());
        if (moderation.account_status === "banned" || activelySuspended) {
          return jsonResponse(request, { error: moderation.public_message || "This account is currently restricted." }, 403);
        }
      }
    }

    const requestBody = await request.json();
    if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody) || Object.keys(requestBody).some((key) => key !== "recordingId")) {
      return jsonResponse(request, { error: "Invalid request body." }, 400);
    }
    recordingId = typeof requestBody.recordingId === "string" ? requestBody.recordingId.trim() : null;
    if (!recordingId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recordingId)) {
      return jsonResponse(request, { error: "A valid recordingId is required." }, 400);
    }

    const { data: recording, error: recordingError } = await userClient
      .from("recording_uploads")
      .select("id, user_id, storage_path, content_type, size_bytes, duration_seconds, status, transcript")
      .eq("id", recordingId)
      .single();

    if (recordingError || !recording) return jsonResponse(request, { error: "Recording not found." }, 404);
    if (recording.user_id !== user.id) return jsonResponse(request, { error: "You cannot access this recording." }, 403);
    if (typeof recording.storage_path !== "string" || !recording.storage_path.startsWith(`${user.id}/`) || recording.storage_path.includes("..")) {
      edgeLog("warn", "transcription_invalid_storage_path", { userId: user.id, recordingId });
      return jsonResponse(request, { error: "Recording metadata is invalid." }, 400);
    }

    if (recording.status === "ready" && recording.transcript) {
      return jsonResponse(request, { recordingId, transcript: recording.transcript, status: "ready" });
    }

    const { data: subscription, error: subscriptionError } = await adminClient
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscriptionError) throw new Error(`Could not verify membership: ${subscriptionError.message}`);

    const membershipActive = Boolean(
      subscription
      && ["active", "trialing"].includes(subscription.status)
      && (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now())
    );

    if (!membershipActive && Number(recording.duration_seconds || 0) > 300) {
      return jsonResponse(request, {
        code: "ARENA_DURATION_MEMBERSHIP_REQUIRED",
        error: "Recording targets longer than five minutes require StoryTuner Membership.",
      }, 403);
    }

    let usage: Record<string, unknown> | null = null;
    if (!membershipActive) {
      const { data: reservation, error: reservationError } = await adminClient.rpc("reserve_storytuner_usage", {
        p_user_id: user.id,
        p_feature: "arena_review",
        p_request_key: recordingId,
      });
      if (reservationError) throw new Error(`Could not verify free usage: ${reservationError.message}`);
      usage = reservation as Record<string, unknown>;
      if (!usage?.allowed) {
        return jsonResponse(request, {
          code: "ARENA_LIMIT_REACHED",
          error: "You have used both free spoken story reviews. Membership unlocks unlimited practice.",
          usage,
        }, 403);
      }
      usageReservedNow = !Boolean(usage.alreadyReserved);
    } else {
      const { error: paidUsageError } = await adminClient.from("user_usage_events").upsert({
        user_id: user.id,
        feature: "arena_review",
        request_key: recordingId,
      }, { onConflict: "user_id,feature,request_key", ignoreDuplicates: true });
      if (paidUsageError) throw new Error(`Could not record Studio usage: ${paidUsageError.message}`);
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: hourCount, error: hourCountError }, { count: dayCount, error: dayCountError }] = await Promise.all([
      adminClient.from("user_usage_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("feature", "arena_review").gte("created_at", hourAgo),
      adminClient.from("user_usage_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("feature", "arena_review").gte("created_at", dayAgo),
    ]);
    if (hourCountError || dayCountError) throw new Error(`Could not verify Studio request rate: ${(hourCountError || dayCountError)?.message}`);
    if ((hourCount ?? 0) > 40 || (dayCount ?? 0) > 120) {
      if (usageReservedNow) {
        await adminClient.from("user_usage_events").delete().eq("user_id", user.id).eq("feature", "arena_review").eq("request_key", recordingId);
        usageReservedNow = false;
      }
      return jsonResponse(request, { code: "RATE_LIMITED", error: "Studio has received unusually many transcription requests from this account. Wait and try again later." }, 429);
    }

    const { data: audioBlob, error: downloadError } = await userClient.storage
      .from("storytuner-recordings")
      .download(recording.storage_path);
    if (downloadError || !audioBlob) throw new Error(`Could not download recording: ${downloadError?.message ?? "File unavailable"}`);
    if (audioBlob.size <= 0 || audioBlob.size > MAX_RECORDING_BYTES) throw new Error("This audio file is not eligible for transcription.");
    if (Number(recording.size_bytes) !== audioBlob.size) {
      edgeLog("warn", "transcription_size_mismatch", { userId: user.id, recordingId, expectedBytes: recording.size_bytes, actualBytes: audioBlob.size });
      throw new Error("Recording metadata does not match the stored audio.");
    }

    const contentType = normalizedAudioMime(recording.content_type || audioBlob.type);
    if (!contentType) return jsonResponse(request, { error: "That recording format is not supported." }, 415);
    const headerBytes = new Uint8Array(await audioBlob.slice(0, 4096).arrayBuffer());
    if (!audioSignatureMatches(headerBytes, contentType)) {
      edgeLog("warn", "transcription_signature_mismatch", { userId: user.id, recordingId, contentType });
      return jsonResponse(request, { error: "The recording contents do not match a supported audio format." }, 415);
    }
    const { error: statusError } = await userClient
      .from("recording_uploads")
      .update({ status: "transcribing", error_message: null })
      .eq("id", recordingId);
    if (statusError) throw new Error(`Could not update recording status: ${statusError.message}`);

    const fileName = `recording-${recordingId}.${safeExtensionForMime(contentType)}`;
    const audioFile = new File([audioBlob], fileName, { type: contentType });
    const transcriptionForm = new FormData();
    transcriptionForm.append("file", audioFile);
    transcriptionForm.append("model", "gpt-4o-mini-transcribe");

    const openAIResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIKey}` },
      body: transcriptionForm,
      signal: AbortSignal.timeout(55_000),
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

    return jsonResponse(request, { recordingId, transcript, title, wordCount, status: "ready", usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown transcription error.";
    if (userClient && recordingId) {
      await userClient.from("recording_uploads").update({ status: "failed", error_message: message.slice(0, 500) }).eq("id", recordingId);
    }
    if (adminClient && userId && recordingId && usageReservedNow) {
      await adminClient
        .from("user_usage_events")
        .delete()
        .eq("user_id", userId)
        .eq("feature", "arena_review")
        .eq("request_key", recordingId);
    }
    edgeLog("error", "transcription_failed", { userId, recordingId, message: message.slice(0, 800) });
    return jsonResponse(request, { error: "Transcription failed." }, 500);
  }
});

function titleFrom(text: string) {
  const sentence = text.split(/[.!?]/)[0]?.trim() || text.trim();
  const words = sentence.replace(/[^\w'’ -]/g, " ").split(/\s+/).filter(Boolean).slice(0, 7);
  return words.length ? words.join(" ") : "Untitled story";
}
