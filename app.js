const $ = (id) => document.getElementById(id);
const speedEl = $("speed");
const altEl = $("alt");
const dateEl = $("date");
const weekdayEl = $("weekday");
const timeEl = $("time");
const gpsEl = $("gps");
const gpsText = $("gpsText");
const startBtn = $("start");

// ---------- Datum & Uhrzeit ----------
const fmtWeekday = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const fmtDate = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function tick() {
  const now = new Date();
  weekdayEl.textContent = fmtWeekday.format(now);
  dateEl.textContent = fmtDate.format(now);
  timeEl.textContent = fmtTime.format(now);
}
tick();
setInterval(tick, 1000);

// ---------- GPS: Geschwindigkeit & Höhe ----------
let last = null;      // letzte Position für Fallback-Berechnung
let smooth = 0;       // geglättete Geschwindigkeit in km/h
let watchId = null;

function distance(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function setStatus(state, text) {
  gpsEl.className = "gps " + state;
  gpsText.textContent = text;
}

function onPosition(pos) {
  const c = pos.coords;
  let ms = c.speed;

  // Manche Geräte liefern keine Geschwindigkeit -> aus zwei Positionen berechnen
  if (ms == null || Number.isNaN(ms)) {
    if (last) {
      const dt = (pos.timestamp - last.timestamp) / 1000;
      ms = dt > 0 ? distance(last.coords, c) / dt : 0;
    } else {
      ms = 0;
    }
  }
  last = pos;

  let kmh = Math.max(0, ms * 3.6);
  if (kmh < 2) kmh = 0; // GPS-Rauschen im Stand ausblenden
  smooth = smooth * 0.4 + kmh * 0.6;
  speedEl.textContent = Math.round(smooth);

  altEl.textContent = c.altitude != null ? Math.round(c.altitude) : "–";

  setStatus("ok", `GPS ±${Math.round(c.accuracy)} m`);
}

function onError(err) {
  const msg = {
    1: "Standortzugriff verweigert",
    2: "Position nicht verfügbar",
    3: "GPS-Zeitüberschreitung",
  }[err.code] || "GPS-Fehler";
  setStatus("err", msg);
}

function startGps() {
  if (!("geolocation" in navigator)) {
    setStatus("err", "Kein GPS verfügbar");
    return;
  }
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
}

// ---------- Bildschirm wach halten ----------
let wakeLock = null;
async function keepAwake() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) {
    /* nicht unterstützt oder abgelehnt */
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && watchId != null) keepAwake();
});

startBtn.addEventListener("click", () => {
  startBtn.classList.add("hidden");
  startGps();
  keepAwake();
});

// ---------- Service Worker (offline / installierbar) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
