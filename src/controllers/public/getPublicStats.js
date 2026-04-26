import { QueryTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { VALID_RANGES, toNumber, roundNumber } from "../stats/helpers.js";

export const getPublicStats = async (req, res) => {
  try {
    const { range = "daily" } = req.query;

    if (!VALID_RANGES.has(range)) {
      return res.status(400).json({ message: "Invalid range" });
    }

    let rows = [];

    
    if (range === "daily") {
      rows = await sequelize.query(
        `
        SELECT
          date as label,
          total_distance_km as distance_km,
          total_carbon_kg as carbon_kg,
          user_count
        FROM global_daily_stats
        ORDER BY date ASC
      `,
        { type: QueryTypes.SELECT }
      );
    }

    if (range === "weekly") {
      rows = await sequelize.query(
        `
        SELECT
          week_start as label,
          total_distance_km as distance_km,
          total_carbon_kg as carbon_kg
        FROM weekly_stats
        ORDER BY week_start ASC
      `,
        { type: QueryTypes.SELECT }
      );
    }

    if (range === "monthly") {
      rows = await sequelize.query(
        `
        SELECT
          month as label,
          total_distance_km as distance_km,
          total_carbon_kg as carbon_kg
        FROM monthly_stats
        ORDER BY month ASC
      `,
        { type: QueryTypes.SELECT }
      );
    }

    if (range === "yearly") {
      rows = await sequelize.query(
        `
        SELECT
          year as label,
          total_distance_km as distance_km,
          total_carbon_kg as carbon_kg
        FROM yearly_stats
        ORDER BY year ASC
      `,
        { type: QueryTypes.SELECT }
      );
    }

    // ✅ Normalize
    const formatted = rows.map((row) => ({
      label: row.label,
      distance_km: toNumber(row.distance_km),
      carbon_kg: toNumber(row.carbon_kg),
      ...(row.user_count !== undefined && { user_count: row.user_count })
    }));

    const totalDistance = formatted.reduce((sum, r) => sum + r.distance_km, 0);
    const totalCarbon = formatted.reduce((sum, r) => sum + r.carbon_kg, 0);

    res.json({
      range,
      total: {
        distance_km: roundNumber(totalDistance),
        carbon_kg: roundNumber(totalCarbon)
      },
      data: formatted
    });
  } catch (err) {
    console.error("Public stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
