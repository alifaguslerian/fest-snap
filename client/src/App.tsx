import { useState } from "react";
import { Idle } from "./pages/ipad/Idle";
import { InputName } from "./pages/ipad/InputName";
import { Capturing } from "./pages/ipad/Capturing";
import { Queue } from "./pages/laptop/Queue";
import { createSession, uploadPhoto, updateSessionStatus, deleteSession } from "./lib/api";

type Screen = "idle" | "inputName" | "capturing";

/**
 * Routing sederhana berdasarkan URL path (bukan hash lagi):
 * - "/"      -> flow iPad (Idle -> Input Nama -> Capturing)
 * - "/queue" -> dashboard Queue laptop
 * Ini karena iPad dan laptop adalah device FISIK BERBEDA yang masing-masing
 * buka URL berbeda di browsernya sendiri — bukan navigasi di satu device yang sama.
 * Detail URL mana dibuka di device mana ada di README.
 */
function App() {
  const isQueuePage = window.location.pathname.startsWith("/queue");

  const [screen, setScreen] = useState<Screen>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (isQueuePage) {
    return (
      <Queue
        onOpenSession={(id) => console.log("Buka sesi (Slice 2):", id)}
        onDeleteAll={() => console.log("Semua data dihapus")}
      />
    );
  }

  if (screen === "idle") {
    return (
      <Idle
        onStart={() => setScreen("inputName")}
      />
    );
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
