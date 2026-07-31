import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

/**
 * Upload hasil composite ke Supabase Storage, dengan timeout singkat (lihat
 * software-architecture.md section 7 — logic dinamis per-sesi: coba cloud,
 * fallback ke local kalau gagal/timeout).
 *
 * Kalau kredensial Supabase belum dikonfigurasi (SUPABASE_URL /
 * SUPABASE_ANON_KEY / SUPABASE_BUCKET belum di-set di .env), fungsi ini
 * langsung return null tanpa mencoba apa pun — sistem otomatis pakai jalur
 * local, sesuai desain "jalan dengan asumsi paling minimal dulu".
 */

const UPLOAD_TIMEOUT_MS = 6_000;

function isCloudConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_BUCKET
  );
}

export async function uploadToCloud(
  localFilePath: string,
  remoteFileName: string
): Promise<string | null> {
  if (!isCloudConfigured()) {
    console.log("[cloud] Belum dikonfigurasi (.env) — skip, pakai jalur local.");
    return null;
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  const bucket = process.env.SUPABASE_BUCKET!;

  const uploadPromise = (async () => {
    const fileBuffer = fs.readFileSync(localFilePath);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(remoteFileName, fileBuffer, { contentType: "image/jpeg", upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(remoteFileName);
    return data.publicUrl;
  })();

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), UPLOAD_TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([uploadPromise, timeoutPromise]);
    if (result === null) {
      console.log("[cloud] Upload timeout, fallback ke local.");
    }
    return result;
  } catch (err) {
    console.error("[cloud] Upload gagal, fallback ke local:", err);
    return null;
  }
}
