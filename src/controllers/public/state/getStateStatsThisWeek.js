import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { toNumber, roundNumber } from "../../stats/helpers.js";

export const getStateStatsThisWeek = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentWeekStart = getWeekStart(todayStr);

    const rows = await sequelize.query(
      `
      SELECT
        state,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM weekly_stats_by_state
      WHERE week_start = :weekStart
      ORDER BY total_carbon_kg DESC
      `,
      {
        replacements: { weekStart: currentWeekStart },
        type: QueryTypes.SELECT
      }
    );

    const formatted = rows.map((row) => ({
      state: row.state,
      distance_km: toNumber(row.distance_km),
      carbon_kg: toNumber(row.carbon_kg),
    }));

    res.json({
      range: "this-week",
      data: formatted
    });
  } catch (err) {
    console.error("State stats this week error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
