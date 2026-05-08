import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { toNumber, roundNumber } from "../../stats/helpers.js";

export const getStateStatsToday = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT
        state,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM global_daily_stats_by_state
      WHERE date = CURRENT_DATE
      ORDER BY total_carbon_kg DESC
      `,
      { type: QueryTypes.SELECT }
    );

    const formatted = rows.map((row) => ({
      state: row.state,
      distance_km: toNumber(row.distance_km),
      carbon_kg: toNumber(row.carbon_kg),
    }));

    res.json({
      range: "today",
      data: formatted
    });
  } catch (err) {
    console.error("State stats today error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
