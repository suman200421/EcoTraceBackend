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

      const existingDateStatesQuery = await sequelize.query(
        `SELECT DISTINCT date, state FROM daily_vehicle_stats WHERE user_id = :userId AND date IN (:dates)`,
        {
          replacements: { userId: req.userId, dates: uniqueDates },
          type: QueryTypes.SELECT,
          transaction
        }
      );
      const existingDateStates = new Set(existingDateStatesQuery.map((r) => `${r.date}_${r.state}`));

      const dailyDeltas = new Map();
      const weeklyDeltas = new Map();
      const monthlyDeltas = new Map();
      const yearlyDeltas = new Map();

      const dailyStateDeltas = new Map();
      const weeklyStateDeltas = new Map();
      const monthlyStateDeltas = new Map();
      const yearlyStateDeltas = new Map();

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

        const stateKey = `${row.date}_${row.state}`;
        if (!dailyStateDeltas.has(stateKey)) {
          dailyStateDeltas.set(stateKey, {
            date: row.date,
            state: row.state,
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingDateStates.has(stateKey) ? 0 : 1
          });
        }
        const dailyState = dailyStateDeltas.get(stateKey);
        dailyState.distanceKm += row.distanceKm;
        dailyState.carbonKg += row.carbonKg;

        const weekStateKey = `${weekStart}_${row.state}`;
        if (!weeklyStateDeltas.has(weekStateKey)) {
          weeklyStateDeltas.set(weekStateKey, { weekStart, state: row.state, distanceKm: 0, carbonKg: 0 });
        }
        const weeklyState = weeklyStateDeltas.get(weekStateKey);
        weeklyState.distanceKm += row.distanceKm;
        weeklyState.carbonKg += row.carbonKg;

        const monthStateKey = `${month}_${row.state}`;
        if (!monthlyStateDeltas.has(monthStateKey)) {
          monthlyStateDeltas.set(monthStateKey, { month, state: row.state, distanceKm: 0, carbonKg: 0 });
        }
        const monthlyState = monthlyStateDeltas.get(monthStateKey);
        monthlyState.distanceKm += row.distanceKm;
        monthlyState.carbonKg += row.carbonKg;

        const yearStateKey = `${year}_${row.state}`;
        if (!yearlyStateDeltas.has(yearStateKey)) {
          yearlyStateDeltas.set(yearStateKey, { year, state: row.state, distanceKm: 0, carbonKg: 0 });
        }
        const yearlyState = yearlyStateDeltas.get(yearStateKey);
        yearlyState.distanceKm += row.distanceKm;
        yearlyState.carbonKg += row.carbonKg;
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

      if (dailyStateDeltas.size > 0) {
        const dailyStateReplacements = [];
        const dailyStatePlaceholders = Array.from(dailyStateDeltas.values())
          .map((data) => {
            dailyStateReplacements.push(data.date, data.state, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO global_daily_stats_by_state (date, state, total_distance_km, total_carbon_kg, user_count)
            VALUES ${dailyStatePlaceholders}
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
          `,
          { replacements: dailyStateReplacements, transaction }
        );
      }

      if (weeklyStateDeltas.size > 0) {
        const weeklyStateReplacements = [];
        const weeklyStatePlaceholders = Array.from(weeklyStateDeltas.values())
          .map((data) => {
            weeklyStateReplacements.push(data.weekStart, data.state, data.distanceKm, data.carbonKg);
            return "(?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO weekly_stats_by_state (week_start, state, total_distance_km, total_carbon_kg)
            VALUES ${weeklyStatePlaceholders}
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
          `,
          { replacements: weeklyStateReplacements, transaction }
        );
      }

      if (monthlyStateDeltas.size > 0) {
        const monthlyStateReplacements = [];
        const monthlyStatePlaceholders = Array.from(monthlyStateDeltas.values())
          .map((data) => {
            monthlyStateReplacements.push(data.month, data.state, data.distanceKm, data.carbonKg);
            return "(?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO monthly_stats_by_state (month, state, total_distance_km, total_carbon_kg)
            VALUES ${monthlyStatePlaceholders}
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
          `,
          { replacements: monthlyStateReplacements, transaction }
        );
      }

      if (yearlyStateDeltas.size > 0) {
        const yearlyStateReplacements = [];
        const yearlyStatePlaceholders = Array.from(yearlyStateDeltas.values())
          .map((data) => {
            yearlyStateReplacements.push(data.year, data.state, data.distanceKm, data.carbonKg);
            return "(?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO yearly_stats_by_state (year, state, total_distance_km, total_carbon_kg)
            VALUES ${yearlyStatePlaceholders}
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
          `,
          { replacements: yearlyStateReplacements, transaction }
        );
      }
    });

    return res.json({ success: true, processed });
  } catch (err) {
    console.error("Ingest vehicle records error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
