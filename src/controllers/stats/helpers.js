export const VALID_RANGES = new Set(["daily", "weekly", "monthly", "yearly"]);
const CARBON_FACTORS = {
  car: 0.12,
  bike: 0.05,
  bus: 0.08,
  train: 0.03
};
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_TIMEOUT_MS = 5000;
const stateCache = new Map();

const padNumber = (value) => String(value).padStart(2, "0");

const formatDate = (date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

export const getDateRange = (range) => {
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(endDate);

  if (range === "weekly") {
    startDate.setDate(startDate.getDate() - 6);
  } else if (range === "monthly") {
    startDate.setDate(1);
  } else if (range === "yearly") {
    startDate.setMonth(0, 1);
  }

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
};

export const toNumber = (value) => Number(value) || 0;

export const roundNumber = (value) => Number(value.toFixed(2));
const isFiniteNumber = (value) => Number.isFinite(Number(value));

export const getWeekStart = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  date.setDate(diff);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
};

export const formatMonth = (dateStr) => {
  return dateStr.substring(0, 7);
};

export const extractYear = (dateStr) => {
  return parseInt(dateStr.substring(0, 4), 10);
};

const parseTimestampToDate = (timestamp) => {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) return null;

  const millis = numericTimestamp > 1e12 ? numericTimestamp : numericTimestamp * 1000;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return null;

  return formatDate(date);
};

const normalizeRecord = (record) => {
  if (!record || typeof record !== "object") return null;

  const { timestamp, distance_km: distanceKmRaw, vehicle_type: vehicleTypeRaw } = record;
  const vehicleType =
    typeof vehicleTypeRaw === "string" ? vehicleTypeRaw.trim().toLowerCase() : "";
  const distanceKm = Number(distanceKmRaw);
  const date = parseTimestampToDate(timestamp);

  if (!date || !vehicleType || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return null;
  }

  const factor = CARBON_FACTORS[vehicleType] ?? 0;

  return {
    date,
    vehicleType,
    distanceKm,
    carbonKg: distanceKm * factor
  };
};

const getCacheKey = (lat, lng) => `${Number(lat).toFixed(2)}_${Number(lng).toFixed(2)}`;

const reverseGeocodeState = async (lat, lng, { retryCount = 1 } = {}) => {
  const cacheKey = getCacheKey(lat, lng);
  if (stateCache.has(cacheKey)) {
    return stateCache.get(cacheKey);
  }

  const url = `${NOMINATIM_BASE_URL}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json`;
  let attempt = 0;

  while (attempt <= retryCount) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "authBackend/1.0"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt < retryCount) {
          attempt += 1;
          continue;
        }
        console.warn(`Reverse geocode failed with status ${response.status}`);
        return null;
      }

      const data = await response.json();
      const state =
        typeof data?.address?.state === "string" && data.address.state.trim()
          ? data.address.state.trim()
          : null;
      stateCache.set(cacheKey, state);
      return state;
    } catch (err) {
      if (attempt < retryCount) {
        attempt += 1;
        continue;
      }
      console.warn("Reverse geocode network failure:", err?.message || err);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
};

const getRepresentativePoints = (records) => {
  if (records.length === 0) return [];
  const middleIndex = Math.floor(records.length / 2);
  return [records[0], records[middleIndex], records[records.length - 1]];
};

const pickMajorityState = (states) => {
  const frequency = new Map();
  for (const state of states) {
    if (!state) continue;
    frequency.set(state, (frequency.get(state) || 0) + 1);
  }

  if (frequency.size === 0) return null;

  let topState = null;
  let topCount = 0;
  let tied = false;

  for (const [state, count] of frequency.entries()) {
    if (count > topCount) {
      topState = state;
      topCount = count;
      tied = false;
    } else if (count === topCount) {
      tied = true;
    }
  }

  if (!tied) return topState;

  const middleState = states[1] || null;
  if (middleState) return middleState;
  return topState;
};

export const validateBatchRecords = (records) => {
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (!record || typeof record !== "object") {
      return `record at index ${i} must be an object`;
    }

    if (record.timestamp === undefined || record.timestamp === null) {
      return `timestamp is required for record at index ${i}`;
    }

    if (record.distance_km === undefined || record.distance_km === null) {
      return `distance_km is required for record at index ${i}`;
    }

    if (record.vehicle_type === undefined || record.vehicle_type === null || record.vehicle_type === "") {
      return `vehicle_type is required for record at index ${i}`;
    }

    if (record.lat === undefined || record.lat === null) {
      return `lat is required for record at index ${i}`;
    }

    if (record.lng === undefined || record.lng === null) {
      return `lng is required for record at index ${i}`;
    }

    if (!isFiniteNumber(record.lat) || !isFiniteNumber(record.lng)) {
      return `lat/lng must be valid numbers for record at index ${i}`;
    }
  }

  return null;
};

export const detectBatchState = async (records) => {
  const points = getRepresentativePoints(records);
  if (points.length === 0) return null;

  const states = await Promise.all(
    points.map((point) => reverseGeocodeState(point.lat, point.lng))
  );

  return pickMajorityState(states);
};

export const aggregateRecords = (records) => {
  const grouped = new Map();
  let processed = 0;

  for (const record of records) {
    const normalized = normalizeRecord(record);
    if (!normalized) continue;

    processed += 1;
    const key = `${normalized.date}|${normalized.vehicleType}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.distanceKm += normalized.distanceKm;
      existing.carbonKg += normalized.carbonKg;
      existing.tripCount += 1;
    } else {
      grouped.set(key, {
        date: normalized.date,
        vehicleType: normalized.vehicleType,
        distanceKm: normalized.distanceKm,
        carbonKg: normalized.carbonKg,
        tripCount: 1
      });
    }
  }

  return { groupedValues: [...grouped.values()], processed };
};
