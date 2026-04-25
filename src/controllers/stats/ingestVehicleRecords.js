import { QueryTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { v4 as uuidv4 } from "uuid";
import {
  validateBatchRecords,
  detectBatchState,
  aggregateRecords,
  getWeekStart,
  formatMonth,
  extractYear
} from "./helpers.js";

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
      const uniqueDates = [...new Set(groupedValues.map((v) => v.date))];

      const existingDatesQuery = await sequelize.query(
        `SELECT DISTINCT date FROM daily_vehicle_stats WHERE user_id = :userId AND date IN (:dates)`,
        {
          replacements: { userId: req.userId, dates: uniqueDates },
          type: QueryTypes.SELECT,
          transaction
        }
      );
      const existingDates = new Set(existingDatesQuery.map((r) => r.date));

      const dailyDeltas = new Map();
      const weeklyDeltas = new Map();
      const monthlyDeltas = new Map();
      const yearlyDeltas = new Map();

      for (const row of groupedValues) {
        if (!dailyDeltas.has(row.date)) {
          dailyDeltas.set(row.date, {
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingDates.has(row.date) ? 0 : 1
          });
        }
        const daily = dailyDeltas.get(row.date);
        daily.distanceKm += row.distanceKm;
        daily.carbonKg += row.carbonKg;

        const weekStart = getWeekStart(row.date);
        if (!weeklyDeltas.has(weekStart)) {
          weeklyDeltas.set(weekStart, { distanceKm: 0, carbonKg: 0 });
        }
        const weekly = weeklyDeltas.get(weekStart);
        weekly.distanceKm += row.distanceKm;
        weekly.carbonKg += row.carbonKg;

        const month = formatMonth(row.date);
        if (!monthlyDeltas.has(month)) {
          monthlyDeltas.set(month, { distanceKm: 0, carbonKg: 0 });
        }
        const monthly = monthlyDeltas.get(month);
        monthly.distanceKm += row.distanceKm;
        monthly.carbonKg += row.carbonKg;

        const year = extractYear(row.date);
        if (!yearlyDeltas.has(year)) {
          yearlyDeltas.set(year, { distanceKm: 0, carbonKg: 0 });
        }
        const yearly = yearlyDeltas.get(year);
        yearly.distanceKm += row.distanceKm;
        yearly.carbonKg += row.carbonKg;
      }

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

      if (dailyDeltas.size > 0) {
        const dailyReplacements = [];
        const dailyPlaceholders = Array.from(dailyDeltas.entries())
          .map(([date, data]) => {
            dailyReplacements.push(date, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO global_daily_stats (date, total_distance_km, total_carbon_kg, user_count)
            VALUES ${dailyPlaceholders}
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
          `,
          { replacements: dailyReplacements, transaction }
        );
      }

      if (weeklyDeltas.size > 0) {
        const weeklyReplacements = [];
        const weeklyPlaceholders = Array.from(weeklyDeltas.entries())
          .map(([weekStart, data]) => {
            weeklyReplacements.push(weekStart, data.distanceKm, data.carbonKg);
            return "(?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO weekly_stats (week_start, total_distance_km, total_carbon_kg)
            VALUES ${weeklyPlaceholders}
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
          `,
          { replacements: weeklyReplacements, transaction }
        );
      }

      if (monthlyDeltas.size > 0) {
        const monthlyReplacements = [];
        const monthlyPlaceholders = Array.from(monthlyDeltas.entries())
          .map(([month, data]) => {
            monthlyReplacements.push(month, data.distanceKm, data.carbonKg);
            return "(?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO monthly_stats (month, total_distance_km, total_carbon_kg)
            VALUES ${monthlyPlaceholders}
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
          `,
          { replacements: monthlyReplacements, transaction }
        );
      }

      if (yearlyDeltas.size > 0) {
        const yearlyReplacements = [];
        const yearlyPlaceholders = Array.from(yearlyDeltas.entries())
          .map(([year, data]) => {
            yearlyReplacements.push(year, data.distanceKm, data.carbonKg);
            return "(?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO yearly_stats (year, total_distance_km, total_carbon_kg)
            VALUES ${yearlyPlaceholders}
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
          `,
          { replacements: yearlyReplacements, transaction }
        );
      }
    });

    return res.json({ success: true, processed });
  } catch (err) {
    console.error("Ingest vehicle records error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
