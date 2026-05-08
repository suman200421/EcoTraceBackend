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
    console.log("Resolved batchState:", batchState);
    if (!batchState) {
      console.warn("Unable to resolve state for vehicle records batch");
    }

    const { groupedValues, processed } = aggregateRecords(records);

    if (groupedValues.length === 0) {
      return res.json({ success: true, processed: 0 });
    }

    console.log("Ingesting for user:", req.userId, "Dates count:", groupedValues.length);

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

      const uniqueYears = [...new Set(groupedValues.map((v) => extractYear(v.date)))];
      const minYear = Math.min(...uniqueYears);
      const maxYear = Math.max(...uniqueYears);

      const existingVehicleRecordsQuery = await sequelize.query(
        `SELECT date, vehicle_type FROM daily_vehicle_stats WHERE user_id = :userId AND date >= :startDate AND date <= :endDate`,
        { replacements: { userId: req.userId, startDate: `${minYear}-01-01`, endDate: `${maxYear}-12-31` }, type: QueryTypes.SELECT, transaction }
      );

      const existingVehicleDates = new Set();
      const existingVehicleWeeks = new Set();
      const existingVehicleMonths = new Set();
      const existingVehicleYears = new Set();

      const existingGlobalWeeks = new Set();
      const existingGlobalMonths = new Set();
      const existingGlobalYears = new Set();

      for (const row of existingVehicleRecordsQuery) {
        existingVehicleDates.add(`${row.date}_${row.vehicle_type}`);
        existingVehicleWeeks.add(`${getWeekStart(row.date)}_${row.vehicle_type}`);
        existingVehicleMonths.add(`${formatMonth(row.date)}_${row.vehicle_type}`);
        existingVehicleYears.add(`${extractYear(row.date)}_${row.vehicle_type}`);

        existingGlobalWeeks.add(getWeekStart(row.date));
        existingGlobalMonths.add(formatMonth(row.date));
        existingGlobalYears.add(extractYear(row.date));
      }

      const dailyDeltas = new Map();
      const weeklyDeltas = new Map();
      const monthlyDeltas = new Map();
      const yearlyDeltas = new Map();

      const dailyStateDeltas = new Map();
      const weeklyStateDeltas = new Map();
      const monthlyStateDeltas = new Map();
      const yearlyStateDeltas = new Map();

      const dailyVehicleDeltas = new Map();
      const weeklyVehicleDeltas = new Map();
      const monthlyVehicleDeltas = new Map();
      const yearlyVehicleDeltas = new Map();

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
          weeklyDeltas.set(weekStart, {
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingGlobalWeeks.has(weekStart) ? 0 : 1
          });
        }
        const weekly = weeklyDeltas.get(weekStart);
        weekly.distanceKm += row.distanceKm;
        weekly.carbonKg += row.carbonKg;

        const month = formatMonth(row.date);
        if (!monthlyDeltas.has(month)) {
          monthlyDeltas.set(month, {
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingGlobalMonths.has(month) ? 0 : 1
          });
        }
        const monthly = monthlyDeltas.get(month);
        monthly.distanceKm += row.distanceKm;
        monthly.carbonKg += row.carbonKg;

        const year = extractYear(row.date);
        if (!yearlyDeltas.has(year)) {
          yearlyDeltas.set(year, {
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingGlobalYears.has(year) ? 0 : 1
          });
        }
        const yearly = yearlyDeltas.get(year);
        yearly.distanceKm += row.distanceKm;
        yearly.carbonKg += row.carbonKg;

        if (batchState) {
          const stateKey = `${row.date}_${batchState}`;
          if (!dailyStateDeltas.has(stateKey)) {
            dailyStateDeltas.set(stateKey, {
              date: row.date,
              state: batchState,
              distanceKm: 0,
              carbonKg: 0,
              userCount: existingDateStates.has(stateKey) ? 0 : 1
            });
          }
          const dailyState = dailyStateDeltas.get(stateKey);
          dailyState.distanceKm += row.distanceKm;
          dailyState.carbonKg += row.carbonKg;

          const weekStateKey = `${weekStart}_${batchState}`;
          if (!weeklyStateDeltas.has(weekStateKey)) {
            weeklyStateDeltas.set(weekStateKey, { weekStart, state: batchState, distanceKm: 0, carbonKg: 0 });
          }
          const weeklyState = weeklyStateDeltas.get(weekStateKey);
          weeklyState.distanceKm += row.distanceKm;
          weeklyState.carbonKg += row.carbonKg;

          const monthStateKey = `${month}_${batchState}`;
          if (!monthlyStateDeltas.has(monthStateKey)) {
            monthlyStateDeltas.set(monthStateKey, { month, state: batchState, distanceKm: 0, carbonKg: 0 });
          }
          const monthlyState = monthlyStateDeltas.get(monthStateKey);
          monthlyState.distanceKm += row.distanceKm;
          monthlyState.carbonKg += row.carbonKg;

          const yearStateKey = `${year}_${batchState}`;
          if (!yearlyStateDeltas.has(yearStateKey)) {
            yearlyStateDeltas.set(yearStateKey, { year, state: batchState, distanceKm: 0, carbonKg: 0 });
          }
          const yearlyState = yearlyStateDeltas.get(yearStateKey);
          yearlyState.distanceKm += row.distanceKm;
          yearlyState.carbonKg += row.carbonKg;
        }

        const vehicleDailyKey = `${row.date}_${row.vehicleType}`;
        if (!dailyVehicleDeltas.has(vehicleDailyKey)) {
          dailyVehicleDeltas.set(vehicleDailyKey, {
            date: row.date,
            vehicleType: row.vehicleType,
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingVehicleDates.has(vehicleDailyKey) ? 0 : 1
          });
        }
        const dailyVehicle = dailyVehicleDeltas.get(vehicleDailyKey);
        dailyVehicle.distanceKm += row.distanceKm;
        dailyVehicle.carbonKg += row.carbonKg;

        const vehicleWeeklyKey = `${weekStart}_${row.vehicleType}`;
        if (!weeklyVehicleDeltas.has(vehicleWeeklyKey)) {
          weeklyVehicleDeltas.set(vehicleWeeklyKey, {
            weekStart,
            vehicleType: row.vehicleType,
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingVehicleWeeks.has(vehicleWeeklyKey) ? 0 : 1
          });
        }
        const weeklyVehicle = weeklyVehicleDeltas.get(vehicleWeeklyKey);
        weeklyVehicle.distanceKm += row.distanceKm;
        weeklyVehicle.carbonKg += row.carbonKg;

        const vehicleMonthlyKey = `${month}_${row.vehicleType}`;
        if (!monthlyVehicleDeltas.has(vehicleMonthlyKey)) {
          monthlyVehicleDeltas.set(vehicleMonthlyKey, {
            month,
            vehicleType: row.vehicleType,
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingVehicleMonths.has(vehicleMonthlyKey) ? 0 : 1
          });
        }
        const monthlyVehicle = monthlyVehicleDeltas.get(vehicleMonthlyKey);
        monthlyVehicle.distanceKm += row.distanceKm;
        monthlyVehicle.carbonKg += row.carbonKg;

        const vehicleYearlyKey = `${year}_${row.vehicleType}`;
        if (!yearlyVehicleDeltas.has(vehicleYearlyKey)) {
          yearlyVehicleDeltas.set(vehicleYearlyKey, {
            year,
            vehicleType: row.vehicleType,
            distanceKm: 0,
            carbonKg: 0,
            userCount: existingVehicleYears.has(vehicleYearlyKey) ? 0 : 1
          });
        }
        const yearlyVehicle = yearlyVehicleDeltas.get(vehicleYearlyKey);
        yearlyVehicle.distanceKm += row.distanceKm;
        yearlyVehicle.carbonKg += row.carbonKg;
      }

      await sequelize.query(
        `
          INSERT INTO daily_vehicle_stats
            (id, user_id, date, vehicle_type, distance_km, carbon_kg, trip_count, state, created_at, updated_at)
          VALUES ${placeholders}
          /* MYSQL:
          ON DUPLICATE KEY UPDATE
            distance_km = distance_km + VALUES(distance_km),
            carbon_kg = carbon_kg + VALUES(carbon_kg),
            trip_count = trip_count + VALUES(trip_count),
            state = VALUES(state),
            updated_at = NOW()
          */
          ON CONFLICT (user_id, date, vehicle_type) DO UPDATE SET
            distance_km = daily_vehicle_stats.distance_km + EXCLUDED.distance_km,
            carbon_kg = daily_vehicle_stats.carbon_kg + EXCLUDED.carbon_kg,
            trip_count = daily_vehicle_stats.trip_count + EXCLUDED.trip_count,
            state = EXCLUDED.state,
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
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
            */
            ON CONFLICT (date) DO UPDATE SET
              total_distance_km = global_daily_stats.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = global_daily_stats.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = global_daily_stats.user_count + EXCLUDED.user_count
          `,
          { replacements: dailyReplacements, transaction }
        );
      }

      if (weeklyDeltas.size > 0) {
        const weeklyReplacements = [];
        const weeklyPlaceholders = Array.from(weeklyDeltas.entries())
          .map(([weekStart, data]) => {
            weeklyReplacements.push(weekStart, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO weekly_stats (week_start, total_distance_km, total_carbon_kg, user_count)
            VALUES ${weeklyPlaceholders}
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
            */
            ON CONFLICT (week_start) DO UPDATE SET
              total_distance_km = weekly_stats.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = weekly_stats.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = weekly_stats.user_count + EXCLUDED.user_count
          `,
          { replacements: weeklyReplacements, transaction }
        );
      }

      if (monthlyDeltas.size > 0) {
        const monthlyReplacements = [];
        const monthlyPlaceholders = Array.from(monthlyDeltas.entries())
          .map(([month, data]) => {
            monthlyReplacements.push(month, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO monthly_stats (month, total_distance_km, total_carbon_kg, user_count)
            VALUES ${monthlyPlaceholders}
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
            */
            ON CONFLICT (month) DO UPDATE SET
              total_distance_km = monthly_stats.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = monthly_stats.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = monthly_stats.user_count + EXCLUDED.user_count
          `,
          { replacements: monthlyReplacements, transaction }
        );
      }

      if (yearlyDeltas.size > 0) {
        const yearlyReplacements = [];
        const yearlyPlaceholders = Array.from(yearlyDeltas.entries())
          .map(([year, data]) => {
            yearlyReplacements.push(year, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO yearly_stats (year, total_distance_km, total_carbon_kg, user_count)
            VALUES ${yearlyPlaceholders}
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
            */
            ON CONFLICT (year) DO UPDATE SET
              total_distance_km = yearly_stats.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = yearly_stats.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = yearly_stats.user_count + EXCLUDED.user_count
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
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
            */
            ON CONFLICT (date, state) DO UPDATE SET
              total_distance_km = global_daily_stats_by_state.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = global_daily_stats_by_state.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = global_daily_stats_by_state.user_count + EXCLUDED.user_count
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
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
            */
            ON CONFLICT (week_start, state) DO UPDATE SET
              total_distance_km = weekly_stats_by_state.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = weekly_stats_by_state.total_carbon_kg + EXCLUDED.total_carbon_kg
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
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
            */
            ON CONFLICT (month, state) DO UPDATE SET
              total_distance_km = monthly_stats_by_state.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = monthly_stats_by_state.total_carbon_kg + EXCLUDED.total_carbon_kg
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
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg)
            */
            ON CONFLICT (year, state) DO UPDATE SET
              total_distance_km = yearly_stats_by_state.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = yearly_stats_by_state.total_carbon_kg + EXCLUDED.total_carbon_kg
          `,
          { replacements: yearlyStateReplacements, transaction }
        );
      }

      if (dailyVehicleDeltas.size > 0) {
        const dailyVehicleReplacements = [];
        const dailyVehiclePlaceholders = Array.from(dailyVehicleDeltas.values())
          .map((data) => {
            dailyVehicleReplacements.push(data.date, data.vehicleType, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO vehicle_daily_stats (date, vehicle_type, total_distance_km, total_carbon_kg, user_count)
            VALUES ${dailyVehiclePlaceholders}
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
            */
            ON CONFLICT (date, vehicle_type) DO UPDATE SET
              total_distance_km = vehicle_daily_stats.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = vehicle_daily_stats.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = vehicle_daily_stats.user_count + EXCLUDED.user_count
          `,
          { replacements: dailyVehicleReplacements, transaction }
        );
      }

      if (weeklyVehicleDeltas.size > 0) {
        const weeklyVehicleReplacements = [];
        const weeklyVehiclePlaceholders = Array.from(weeklyVehicleDeltas.values())
          .map((data) => {
            weeklyVehicleReplacements.push(data.weekStart, data.vehicleType, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO vehicle_weekly_stats (week_start, vehicle_type, total_distance_km, total_carbon_kg, user_count)
            VALUES ${weeklyVehiclePlaceholders}
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
            */
            ON CONFLICT (week_start, vehicle_type) DO UPDATE SET
              total_distance_km = vehicle_weekly_stats.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = vehicle_weekly_stats.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = vehicle_weekly_stats.user_count + EXCLUDED.user_count
          `,
          { replacements: weeklyVehicleReplacements, transaction }
        );
      }

      if (monthlyVehicleDeltas.size > 0) {
        const monthlyVehicleReplacements = [];
        const monthlyVehiclePlaceholders = Array.from(monthlyVehicleDeltas.values())
          .map((data) => {
            monthlyVehicleReplacements.push(data.month, data.vehicleType, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO vehicle_monthly_stats (month, vehicle_type, total_distance_km, total_carbon_kg, user_count)
            VALUES ${monthlyVehiclePlaceholders}
            /* MYSQL:
            ON DUPLICATE KEY UPDATE
              total_distance_km = total_distance_km + VALUES(total_distance_km),
              total_carbon_kg = total_carbon_kg + VALUES(total_carbon_kg),
              user_count = user_count + VALUES(user_count)
            */
            ON CONFLICT (month, vehicle_type) DO UPDATE SET
              total_distance_km = vehicle_monthly_stats.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = vehicle_monthly_stats.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = vehicle_monthly_stats.user_count + EXCLUDED.user_count
          `,
          { replacements: monthlyVehicleReplacements, transaction }
        );
      }

      if (yearlyVehicleDeltas.size > 0) {
        const yearlyVehicleReplacements = [];
        const yearlyVehiclePlaceholders = Array.from(yearlyVehicleDeltas.values())
          .map((data) => {
            yearlyVehicleReplacements.push(data.year, data.vehicleType, data.distanceKm, data.carbonKg, data.userCount);
            return "(?, ?, ?, ?, ?)";
          })
          .join(", ");

        await sequelize.query(
          `
            INSERT INTO vehicle_yearly_stats (year, vehicle_type, total_distance_km, total_carbon_kg, user_count)
            VALUES ${yearlyVehiclePlaceholders}
            ON CONFLICT (year, vehicle_type) DO UPDATE SET
              total_distance_km = vehicle_yearly_stats.total_distance_km + EXCLUDED.total_distance_km,
              total_carbon_kg = vehicle_yearly_stats.total_carbon_kg + EXCLUDED.total_carbon_kg,
              user_count = vehicle_yearly_stats.user_count + EXCLUDED.user_count
          `,
          { replacements: yearlyVehicleReplacements, transaction }
        );
      }
    });

    return res.json({ success: true, processed });
  } catch (err) {
    console.error("Ingest vehicle records error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
