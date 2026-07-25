/**
 * Helper untuk manggil API server sendiri (bukan layanan pihak ketiga).
 * Semua request lewat /api, yang di-proxy Vite ke server Express di
 * https://localhost:8443 (lihat vite.config.ts).
 */

export interface CreateSessionResponse {
  id: string;
  displayName: string;
  createdAt: number;
  status: string;
}

export async function createSession(displayName: string): Promise<CreateSessionResponse> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Gagal membuat sesi (status ${res.status})`);
  }
  return res.json();
}

export async function uploadPhoto(sessionId: string, photoBlob: Blob): Promise<void> {
  const formData = new FormData();
  formData.append("photo", photoBlob, "photo.jpg");

  const res = await fetch(`/api/sessions/${sessionId}/photos`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Gagal upload foto (status ${res.status})`);
  }
}

export async function updateSessionStatus(sessionId: string, status: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Gagal update status (status ${res.status})`);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    // 404 dianggap OK di sini — kalau sesi memang belum sempat tersimpan
    // (mis. gagal di tengah proses), tidak perlu dianggap error.
    throw new Error(`Gagal menghapus sesi (status ${res.status})`);
  }
}

export async function deleteAllSessions(): Promise<void> {
  const res = await fetch(`/api/sessions`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Gagal menghapus semua data (status ${res.status})`);
  }
}

export interface QueueSessionDTO {
  id: string;
  name: string;
  timestamp: string;
  status: "Menunggu" | "Diedit" | "Siap Cetak" | "Tercetak";
}

export async function fetchSessions(): Promise<QueueSessionDTO[]> {
  const res = await fetch("/api/sessions");
  if (!res.ok) {
    throw new Error(`Gagal mengambil daftar sesi (status ${res.status})`);
  }
  const body = await res.json();
  return body.sessions;
}
