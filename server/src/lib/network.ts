import os from "node:os";

/**
 * Deteksi IP address laptop di jaringan lokal (LAN) — dipakai supaya QR code
 * bisa diakses dari HP pengunjung, bukan cuma dari laptop itu sendiri
 * ("localhost" tidak bisa diakses device lain).
 *
 * Ambil interface non-internal IPv4 pertama yang ketemu. Untuk skala event
 * ini (satu laptop, satu jaringan aktif) ini cukup — kalau laptop punya
 * banyak interface aktif sekaligus (jarang), override manual lewat env
 * LOCAL_NETWORK_IP.
 */
export function getLocalNetworkIp(): string {
  if (process.env.LOCAL_NETWORK_IP) {
    return process.env.LOCAL_NETWORK_IP;
  }

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }

  // Fallback kalau gak ketemu interface LAN sama sekali (misal offline total)
  return "localhost";
}
