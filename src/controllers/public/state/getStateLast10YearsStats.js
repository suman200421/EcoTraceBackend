import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { toNumber } from "../../stats/helpers.js";

export const getStateLast10YearsStats = async (req, res) => {
  try {
    let { state } = req.query;
    if (!state || typeof state !== "string" || !state.trim()) {
      return res.status(400).json({ message: "State is required" });
    }
    state = state.trim();

    const rows = await sequelize.query(
      `
      SELECT
        year as label,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM yearly_stats_by_state
      WHERE state = :state AND year >= YEAR(CURDATE()) - 9
      ORDER BY year ASC
      `,
      {
        replacements: { state },
        type: QueryTypes.SELECT
      }
    );

    const resultMap = new Map(rows.map(r => [r.label, r]));
    const formatted = [];

    const currentYear = new Date().getFullYear();
    for (let i = 9; i >= 0; i--) {
      const yearStr = currentYear - i;
      const row = resultMap.get(yearStr) || resultMap.get(String(yearStr));

      formatted.push({
        label: String(yearStr),
        distance_km: toNumber(row?.distance_km),
        carbon_kg: toNumber(row?.carbon_kg)
      });
    }

    res.json({
      state,
      range: "last_10_years",
      data: formatted
    });
  } catch (err) {
    console.error("State last 10 years error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
