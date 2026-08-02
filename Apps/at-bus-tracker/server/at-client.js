/**
 * Minimal Auckland Transport realtime client.
 * Keeps the subscription key server-side and resolves a single bus
 * by vehicle id, fleet label, or number plate.
 */

const AT_VEHICLE_URL = 'https://api.at.govt.nz/realtime/legacy/vehiclelocations';

/**
 * @typedef {object} BusTarget
 * @property {string} vehicleId
 * @property {string} fleetLabel
 * @property {string} plate
 */

/**
 * @typedef {object} BusLocation
 * @property {boolean} online
 * @property {string|null} vehicleId
 * @property {string|null} fleetLabel
 * @property {string|null} plate
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {number|null} bearing
 * @property {number|null} speed
 * @property {string|null} routeId
 * @property {string|null} tripId
 * @property {string|null} lastUpdate
 * @property {string} fetchedAt
 * @property {string} [message]
 */

/**
 * @param {string} apiKey
 * @param {BusTarget} target
 * @returns {Promise<BusLocation>}
 */
export async function fetchBusLocation(apiKey, target) {
  const fetchedAt = new Date().toISOString();
  const vehicleId = String(target.vehicleId || '').trim();
  const fleetLabel = String(target.fleetLabel || '').trim().toUpperCase();
  const plate = String(target.plate || '').trim().toUpperCase();

  // Prefer a filtered request when we know the AVL id.
  let entities = await requestEntities(apiKey, vehicleId ? { vehicleid: vehicleId } : undefined);

  let match = findMatchingEntity(entities, { vehicleId, fleetLabel, plate });

  // Fallback: full feed scan if filtered call missed (id drift / offline filter quirks).
  if (!match && (fleetLabel || plate)) {
    entities = await requestEntities(apiKey);
    match = findMatchingEntity(entities, { vehicleId, fleetLabel, plate });
  }

  if (!match) {
    return {
      online: false,
      vehicleId: vehicleId || null,
      fleetLabel: fleetLabel || null,
      plate: plate || null,
      latitude: null,
      longitude: null,
      bearing: null,
      speed: null,
      routeId: null,
      tripId: null,
      lastUpdate: null,
      fetchedAt,
      message: 'Bus is not currently reporting a live position.',
    };
  }

  const vehicle = match.vehicle || {};
  const descriptor = vehicle.vehicle || {};
  const position = vehicle.position || {};
  const trip = vehicle.trip || {};
  const timestamp = vehicle.timestamp ? Number(vehicle.timestamp) : null;

  return {
    online: true,
    vehicleId: descriptor.id ? String(descriptor.id) : match.id ? String(match.id) : vehicleId || null,
    fleetLabel: descriptor.label ? String(descriptor.label) : fleetLabel || null,
    plate: descriptor.license_plate ? String(descriptor.license_plate) : plate || null,
    latitude: typeof position.latitude === 'number' ? position.latitude : null,
    longitude: typeof position.longitude === 'number' ? position.longitude : null,
    bearing: position.bearing !== undefined && position.bearing !== null ? Number(position.bearing) : null,
    speed: typeof position.speed === 'number' ? position.speed : null,
    routeId: trip.route_id ? String(trip.route_id) : null,
    tripId: trip.trip_id ? String(trip.trip_id) : null,
    lastUpdate: timestamp ? new Date(timestamp * 1000).toISOString() : null,
    fetchedAt,
  };
}

/**
 * @param {string} apiKey
 * @param {Record<string, string>} [query]
 * @returns {Promise<Array<object>>}
 */
async function requestEntities(apiKey, query) {
  const url = new URL(AT_VEHICLE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AT API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data?.status && data.status !== 'OK') {
    throw new Error(`AT API status ${data.status}: ${JSON.stringify(data.error || {})}`);
  }

  return data?.response?.entity || [];
}

/**
 * @param {Array<object>} entities
 * @param {{ vehicleId: string, fleetLabel: string, plate: string }} target
 * @returns {object|null}
 */
function findMatchingEntity(entities, target) {
  for (const entity of entities) {
    const vehicle = entity?.vehicle || {};
    const descriptor = vehicle.vehicle || {};
    const id = String(descriptor.id || entity.id || '');
    const label = String(descriptor.label || '').toUpperCase();
    const licensePlate = String(descriptor.license_plate || '').toUpperCase();

    if (target.vehicleId && id === target.vehicleId) return entity;
    if (target.fleetLabel && label === target.fleetLabel) return entity;
    if (target.plate && licensePlate === target.plate) return entity;
  }
  return null;
}
