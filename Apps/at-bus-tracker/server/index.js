import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { fetchBusLocation } from './at-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const PORT = Number(process.env.PORT || 3000);
const AT_API_KEY = process.env.AT_API_KEY || '';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 15_000);

const busTarget = {
  vehicleId: process.env.BUS_VEHICLE_ID || '15836',
  fleetLabel: process.env.BUS_FLEET_LABEL || 'NB5836',
  plate: process.env.BUS_PLATE || 'QCH657',
};

/** @type {{ expiresAt: number, value: object } | null} */
let cache = null;

const app = express();

app.disable('x-powered-by');

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(AT_API_KEY),
    bus: busTarget,
  });
});

app.get('/api/bus', async (_req, res) => {
  if (!AT_API_KEY) {
    res.status(500).json({
      error: 'AT_API_KEY is not configured on the server.',
    });
    return;
  }

  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    res.json({ ...cache.value, cached: true });
    return;
  }

  try {
    const location = await fetchBusLocation(AT_API_KEY, busTarget);
    cache = {
      expiresAt: now + CACHE_TTL_MS,
      value: location,
    };
    res.json({ ...location, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(502).json({
      error: 'Failed to fetch bus location from Auckland Transport.',
      detail: message,
    });
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    vehicleId: busTarget.vehicleId,
    fleetLabel: busTarget.fleetLabel,
    plate: busTarget.plate,
    pollIntervalMs: 30_000,
  });
});

app.use(express.static(path.join(rootDir, 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AT bus tracker listening on http://localhost:${PORT}`);
  if (!AT_API_KEY) {
    console.warn('Warning: AT_API_KEY is missing. Set it in Apps/at-bus-tracker/.env');
  }
});
