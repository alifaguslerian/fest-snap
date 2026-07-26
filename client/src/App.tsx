import { useState } from "react";
import { Idle } from "./pages/ipad/Idle";
import { InputName } from "./pages/ipad/InputName";
import { Capturing } from "./pages/ipad/Capturing";
import { Queue } from "./pages/laptop/Queue";
import { Editing } from "./pages/laptop/Editing";
import { createSession, uploadPhoto, updateSessionStatus, deleteSession } from "./lib/api";

type Screen = "idle" | "inputName" | "capturing";

/**
 * Routing berdasarkan URL path (full navigation, bukan client-side router —
 * cukup untuk skala project ini, lihat implementation-plan.md):
 * - "/"          -> flow iPad (Idle -> Input Nama -> Capturing)
 * - "/queue"     -> dashboard Queue laptop
 * - "/queue/:id" -> halaman Editing untuk satu sesi (Slice 2)
 */
function App() {
  const path = window.location.pathname;
  const editSessionMatch = path.match(/^\/queue\/([^/]+)$/);

  const [screen, setScreen] = useState<Screen>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (editSessionMatch) {
    const sessionIdFromUrl = editSessionMatch[1];
    return (
      <Editing
        sessionId={sessionIdFromUrl}
        onBackToQueue={() => {
          window.location.href = "/queue";
        }}
        onDeleteSession={() => {
          if (!window.confirm("Hapus sesi ini secara permanen?")) return;
          deleteSession(sessionIdFromUrl)
            .then(() => {
              window.location.href = "/queue";
            })
            .catch((err) => console.error("Gagal menghapus sesi:", err));
        }}
      />
    );
  }

  if (path.startsWith("/queue")) {
    return (
      <Queue
        onOpenSession={(id) => {
          window.location.href = `/queue/${id}`;
        }}
        onDeleteAll={() => console.log("Semua data dihapus")}
      />
    );
  }

  if (screen === "idle") {
    return <Idle onStart={() => setScreen("inputName")} />;
  }

  if (screen === "inputName") {
    return (
      <InputName
        onSubmit={async (name) => {
          try {
            const session = await createSession(name);
            setSessionId(session.id);
            setScreen("capturing");
          } catch (err) {
            console.error("Gagal membuat sesi:", err);
            setScreen("idle");
          }
        }}
        onTimeout={() => setScreen("idle")}
      />
    );
  }

  // screen === "capturing"
  return (
    <Capturing
      onPhotoCaptured={(blob) => {
        if (!sessionId) return;
        uploadPhoto(sessionId, blob).catch((err) => console.error("Gagal upload foto:", err));
      }}
      onSessionComplete={async () => {
        if (!sessionId) return;
        try {
          await updateSessionStatus(sessionId, "Waiting");
        } catch (err) {
          console.error("Gagal update status ke Waiting:", err);
        }
        setSessionId(null);
        setScreen("idle");
      }}
      onCaptureError={(err) => {
        console.error("Capture gagal:", err.message);
        if (sessionId) {
          deleteSession(sessionId).catch((delErr) => console.error("Gagal cleanup sesi gagal:", delErr));
        }
        setSessionId(null);
        setScreen("idle");
      }}
      onTimeout={() => {
        if (sessionId) {
          deleteSession(sessionId).catch((delErr) => console.error("Gagal cleanup sesi timeout:", delErr));
        }
        setSessionId(null);
        setScreen("idle");
      }}
    />
  );
}

export default App;