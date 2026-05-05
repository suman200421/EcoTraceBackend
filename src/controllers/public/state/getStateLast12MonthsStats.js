import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { toNumber } from "../../stats/helpers.js";

const padNumber = (num) => String(num).padStart(2, "0");

export const getStateLast12MonthsStats = async (req, res) => {
  try {
    let { state } = req.query;
    if (!state || typeof state !== "string" || !state.trim()) {
      return res.status(400).json({ message: "State is required" });
    }
    state = state.trim();

    const rows = await sequelize.query(
      `
      SELECT
        month as label,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM monthly_stats_by_state
      /* MYSQL:
      WHERE state = :state AND month >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m')
      */
      WHERE state = :state AND month >= TO_CHAR(CURRENT_DATE - INTERVAL '11 months', 'YYYY-MM')
      ORDER BY month ASC
      `,
      {
        replacements: { state },
        type: QueryTypes.SELECT
      }
    );

    const resultMap = new Map(rows.map(r => [r.label, r]));
    const formatted = [];

    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${padNumber(d.getMonth() + 1)}`;

      const row = resultMap.get(monthStr);

      formatted.push({
        label: monthStr,
        distance_km: toNumber(row?.distance_km),
        carbon_kg: toNumber(row?.carbon_kg)
      });
    }

    res.json({
      state,
      range: "last_12_months",
      data: formatted
    });
  } catch (err) {
    console.error("State last 12 months error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
