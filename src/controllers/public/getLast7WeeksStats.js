import { QueryTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { toNumber, roundNumber } from "../stats/helpers.js";

// helper → get Monday of a given date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export const getLast7WeeksStats = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT
        week_start as label,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM weekly_stats
      WHERE week_start >= DATE_SUB(CURDATE(), INTERVAL 6 WEEK)
      ORDER BY week_start ASC
      `,
      { type: QueryTypes.SELECT }
    );

    // 🔥 Map existing data
    const resultMap = new Map(rows.map(r => [r.label, r]));

    const formatted = [];

    // get current week start (Monday)
    const currentWeekStart = getWeekStart(new Date());

    for (let i = 6; i >= 0; i--) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() - i * 7);

      const weekStr = new Date(
        d.getTime() - d.getTimezoneOffset() * 60000
      ).toISOString().slice(0, 10);

      const row = resultMap.get(weekStr);

      formatted.push({
        label: weekStr,
        distance_km: toNumber(row?.distance_km),
        carbon_kg: toNumber(row?.carbon_kg)
      });
    }

    const totalDistance = formatted.reduce((sum, r) => sum + r.distance_km, 0);
    const totalCarbon = formatted.reduce((sum, r) => sum + r.carbon_kg, 0);

    res.json({
      range: "last_7_weeks",
      total: {
        distance_km: roundNumber(totalDistance),
        carbon_kg: roundNumber(totalCarbon)
      },
      data: formatted
    });

  } catch (err) {
    console.error("Last 7 weeks error:", err);
    res.status(500).json({ message: "Server error" });
  }
};