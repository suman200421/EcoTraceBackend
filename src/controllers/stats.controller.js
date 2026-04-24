import { QueryTypes } from "sequelize";
import sequelize from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

const VALID_RANGES = new Set(["daily", "weekly", "monthly", "yearly"]);
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

const getDateRange = (range) => {
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

const toNumber = (value) => Number(value) || 0;

const roundNumber = (value) => Number(value.toFixed(2));
const isFiniteNumber = (value) => Number.isFinite(Number(value));

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

const validateBatchRecords = (records) => {
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

const detectBatchState = async (records) => {
  const points = getRepresentativePoints(records);
  if (points.length === 0) return null;

  const states = await Promise.all(
    points.map((point) => reverseGeocodeState(point.lat, point.lng))
  );

  return pickMajorityState(states);
};

const aggregateRecords = (records) => {
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

export const getStats = async (req, res) => {
  try {
    const { range = "daily" } = req.query;

    if (!VALID_RANGES.has(range)) {
      return res.status(400).json({ message: "Invalid range" });
    }

    const { startDate, endDate } = getDateRange(range);

    const rows = await sequelize.query(
      `
        SELECT
          vehicle_type,
          SUM(distance_km) AS distance_km,
          SUM(carbon_kg) AS carbon_kg
        FROM daily_vehicle_stats
        WHERE user_id = :userId
          AND date BETWEEN :startDate AND :endDate
        GROUP BY vehicle_type
      `,
      {
        replacements: {
          userId: req.userId,
          startDate,
          endDate
        },
        type: QueryTypes.SELECT
      }
    );

    const vehicles = rows
      .map((row) => ({
        type: row.vehicle_type,
        distance_km: toNumber(row.distance_km),
        carbon_kg: toNumber(row.carbon_kg)
      }))
      .sort((a, b) => b.distance_km - a.distance_km);

    const totalDistance = vehicles.reduce((sum, vehicle) => sum + vehicle.distance_km, 0);
    const totalCarbon = vehicles.reduce((sum, vehicle) => sum + vehicle.carbon_kg, 0);

    const responseVehicles = vehicles.map((vehicle) => ({
      type: vehicle.type,
      distance_km: roundNumber(vehicle.distance_km),
      carbon_kg: roundNumber(vehicle.carbon_kg),
      percentage:
        totalDistance === 0
          ? 0
          : roundNumber((vehicle.distance_km / totalDistance) * 100)
    }));

    let groupedVehicles = responseVehicles;

    if (responseVehicles.length > 4) {
      const topVehicles = responseVehicles.slice(0, 4);
      const remainingVehicles = responseVehicles.slice(4);
      const othersDistance = remainingVehicles.reduce(
        (sum, vehicle) => sum + vehicle.distance_km,
        0
      );
      const othersCarbon = remainingVehicles.reduce(
        (sum, vehicle) => sum + vehicle.carbon_kg,
        0
      );

      groupedVehicles = [
        ...topVehicles,
        {
          type: "others",
          distance_km: roundNumber(othersDistance),
          carbon_kg: roundNumber(othersCarbon),
          percentage:
            totalDistance === 0
              ? 0
              : roundNumber((othersDistance / totalDistance) * 100)
        }
      ];
    }

    res.json({
      range,
      start_date: startDate,
      end_date: endDate,
      total: {
        distance_km: roundNumber(totalDistance),
        carbon_kg: roundNumber(totalCarbon)
      },
      vehicles: groupedVehicles
    });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const ingestVehicleRecords = async (req, res) => {
  const { records } = req.body ?? {};

  if (!Array.isArray(records)) {
    return res.status(400).json({ message: "records must be an array" });
  }

  const validationError = validateBatchRecords(records);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const batchState = await detectBatchState(records);
    if (!batchState) {
      console.warn("Unable to resolve state for vehicle records batch");
    }

    const { groupedValues, processed } = aggregateRecords(records);

    if (groupedValues.length === 0) {
      return res.json({ success: true, processed: 0 });
    }

    const placeholders = groupedValues
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())")
      .join(", ");

    const replacements = [];
    for (const row of groupedValues) {
      replacements.push(
        uuidv4(),
        req.userId,
        row.date,
        row.vehicleType,
        row.distanceKm,
        row.carbonKg,
        row.tripCount,
        batchState
      );
    }

    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `
          INSERT INTO daily_vehicle_stats
            (id, user_id, date, vehicle_type, distance_km, carbon_kg, trip_count, state, created_at, updated_at)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            distance_km = distance_km + VALUES(distance_km),
            carbon_kg = carbon_kg + VALUES(carbon_kg),
            trip_count = trip_count + VALUES(trip_count),
            state = VALUES(state),
            updated_at = NOW()
        `,
        {
          replacements,
          transaction
        }
      );
    });

    return res.json({ success: true, processed });
  } catch (err) {
    console.error("Ingest vehicle records error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
