import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { toNumber } from "../../stats/helpers.js";

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export const getStateLast7WeeksStats = async (req, res) => {
  try {
    let { state } = req.query;
    if (!state || typeof state !== "string" || !state.trim()) {
      return res.status(400).json({ message: "State is required" });
    }
    state = state.trim();

    const rows = await sequelize.query(
      `
      SELECT
        week_start as label,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM weekly_stats_by_state
      WHERE state = :state AND week_start >= DATE_SUB(CURDATE(), INTERVAL 6 WEEK)
      ORDER BY week_start ASC
      `,
      {
        replacements: { state },
        type: QueryTypes.SELECT
      }
    );

    const resultMap = new Map(rows.map(r => [r.label, r]));
    const formatted = [];
    const currentWeekStart = getWeekStart(new Date());

    for (let i = 6; i >= 0; i--) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() - i * 7);

      const weekStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);

      const row = resultMap.get(weekStr);

      formatted.push({
        label: weekStr,
        distance_km: toNumber(row?.distance_km),
        carbon_kg: toNumber(row?.carbon_kg)
      });
    }

    res.json({
      state,
      range: "last_7_weeks",
      data: formatted
    });
  } catch (err) {
    console.error("State last 7 weeks error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
