import { QueryTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { toNumber, formatMonth } from "../stats/helpers.js";

export const getStateStatsThisMonth = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = formatMonth(todayStr);

    const rows = await sequelize.query(
      `
      SELECT
        state,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM monthly_stats_by_state
      WHERE month = :month
      ORDER BY total_carbon_kg DESC
      `,
      { 
        replacements: { month: currentMonth },
        type: QueryTypes.SELECT 
      }
    );

    const formatted = rows.map((row) => ({
      state: row.state,
      distance_km: toNumber(row.distance_km),
      carbon_kg: toNumber(row.carbon_kg),
    }));

    res.json({
      range: "this-month",
      data: formatted
    });
  } catch (err) {
    console.error("State stats this month error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
