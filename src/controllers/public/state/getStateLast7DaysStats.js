import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { toNumber } from "../../stats/helpers.js";

export const getStateLast7DaysStats = async (req, res) => {
  try {
    let { state } = req.query;
    if (!state || typeof state !== "string" || !state.trim()) {
      return res.status(400).json({ message: "State is required" });
    }
    state = state.trim();

    const rows = await sequelize.query(
      `
      SELECT
        date as label,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg,
        user_count
      FROM global_daily_stats_by_state
      /* MYSQL:
      WHERE state = :state AND date >= CURRENT_DATE - INTERVAL 6 DAY
      */
      WHERE state = :state AND date >= CURRENT_DATE - INTERVAL '6 days'
      ORDER BY date ASC
      `,
      {
        replacements: { state },
        type: QueryTypes.SELECT
      }
    );

    const resultMap = new Map(rows.map(r => [r.label, r]));
    const formatted = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const row = resultMap.get(dateStr);

      formatted.push({
        label: dateStr,
        distance_km: toNumber(row?.distance_km),
        carbon_kg: toNumber(row?.carbon_kg),
        user_count: row?.user_count || 0
      });
    }

    res.json({
      state,
      range: "last_7_days",
      data: formatted
    });
  } catch (err) {
    console.error("State last 7 days error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
