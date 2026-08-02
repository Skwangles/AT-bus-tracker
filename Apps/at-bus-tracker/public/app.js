const AUCKLAND_CENTRE = [-36.8485, 174.7633];
const DEFAULT_ZOOM = 12;
const TRACK_ZOOM = 15;

const els = {
  fleetBrand: document.getElementById('fleetBrand'),
  plateLine: document.getElementById('plateLine'),
  statusPill: document.getElementById('statusPill'),
  statusText: document.getElementById('statusText'),
  routeValue: document.getElementById('routeValue'),
  updatedValue: document.getElementById('updatedValue'),
  nextPollValue: document.getElementById('nextPollValue'),
  mapCaption: document.getElementById('mapCaption'),
};

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
}).setView(AUCKLAND_CENTRE, DEFAULT_ZOOM);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 19,
}).addTo(map);

const busIcon = L.divIcon({
  className: '',
  html: '<div class="bus-marker" aria-hidden="true"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/** @type {L.Marker | null} */
let marker = null;
/** @type {number} */
let pollIntervalMs = 30_000;
/** @type {number | null} */
let countdownTimer = null;
/** @type {number} */
let nextPollAt = 0;

/**
 * @param {string} state
 * @param {string} text
 */
function setStatus(state, text) {
  els.statusPill.dataset.state = state;
  els.statusText.textContent = text;
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
function formatNzTime(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function startCountdown() {
  if (countdownTimer) window.clearInterval(countdownTimer);
  countdownTimer = window.setInterval(() => {
    const remaining = Math.max(0, Math.ceil((nextPollAt - Date.now()) / 1000));
    els.nextPollValue.textContent = remaining === 0 ? 'now' : `${remaining}s`;
  }, 250);
}

/**
 * @param {object} bus
 * @param {{ fleetLabel?: string, plate?: string }} config
 */
function renderBus(bus, config) {
  const fleet = bus.fleetLabel || config.fleetLabel || 'NB5836';
  const plate = bus.plate || config.plate || 'QCH657';

  els.fleetBrand.textContent = fleet;
  els.plateLine.textContent = bus.online
    ? `Plate ${plate} · live on the network`
    : `Plate ${plate} · not currently reporting`;

  els.routeValue.textContent = bus.routeId || '—';
  els.updatedValue.textContent = formatNzTime(bus.lastUpdate || bus.fetchedAt);

  if (bus.online && typeof bus.latitude === 'number' && typeof bus.longitude === 'number') {
    setStatus('online', 'Online');
    const latLng = [bus.latitude, bus.longitude];
    if (!marker) {
      marker = L.marker(latLng, { icon: busIcon }).addTo(map);
      map.setView(latLng, TRACK_ZOOM);
    } else {
      marker.setLatLng(latLng);
      map.panTo(latLng, { animate: true, duration: 0.8 });
    }

    const speedKmh =
      typeof bus.speed === 'number' && bus.speed > 0 ? `${Math.round(bus.speed * 3.6)} km/h` : 'stopped / crawl';
    els.mapCaption.textContent = `${fleet} at ${bus.latitude.toFixed(5)}, ${bus.longitude.toFixed(5)} · ${speedKmh}`;
  } else {
    setStatus(bus.error ? 'error' : 'offline', bus.error ? 'Error' : 'Offline');
    els.mapCaption.textContent =
      bus.message || 'NB5836 is not reporting a live position. The map will jump when it appears.';
  }
}

/**
 * @returns {Promise<object>}
 */
async function loadConfig() {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Could not load tracker config');
  return response.json();
}

/**
 * @returns {Promise<object>}
 */
async function loadBus() {
  const response = await fetch('/api/bus');
  const data = await response.json();
  if (!response.ok) {
    return {
      online: false,
      error: true,
      message: data.detail || data.error || 'Request failed',
      fetchedAt: new Date().toISOString(),
    };
  }
  return data;
}

/**
 * @param {object} config
 */
async function poll(config) {
  setStatus('searching', marker ? 'Refreshing' : 'Searching');
  try {
    const bus = await loadBus();
    renderBus(bus, config);
  } catch (error) {
    renderBus(
      {
        online: false,
        error: true,
        message: error instanceof Error ? error.message : 'Unexpected error',
        fetchedAt: new Date().toISOString(),
      },
      config,
    );
  } finally {
    nextPollAt = Date.now() + pollIntervalMs;
    startCountdown();
  }
}

async function bootstrap() {
  let config = {
    fleetLabel: 'NB5836',
    plate: 'QCH657',
    pollIntervalMs: 30_000,
  };

  try {
    config = await loadConfig();
    pollIntervalMs = Number(config.pollIntervalMs) || 30_000;
    els.fleetBrand.textContent = config.fleetLabel || 'NB5836';
    els.plateLine.textContent = `Plate ${config.plate || 'QCH657'} · waiting for signal`;
  } catch {
    // Keep defaults if config endpoint is unavailable.
  }

  await poll(config);
  window.setInterval(() => {
    void poll(config);
  }, pollIntervalMs);
}

void bootstrap();
