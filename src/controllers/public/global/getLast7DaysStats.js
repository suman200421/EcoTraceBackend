// import { QueryTypes } from "sequelize";
// import sequelize from "../../config/db.js";
// import { toNumber, roundNumber } from "../stats/helpers.js";
import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { toNumber, roundNumber } from "../../stats/helpers.js";

export const getLast7DaysStats = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT
        date as label,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg,
        user_count
      FROM global_daily_stats
      WHERE date >= CURRENT_DATE - INTERVAL '6 days'
      ORDER BY date ASC
      `,
      { type: QueryTypes.SELECT }
    );


    //handel missing date value by setting them to 0

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

    // ✅ NOW compute totals from formatted (NOT rows)
    const totalDistance = formatted.reduce((sum, r) => sum + r.distance_km, 0);
    const totalCarbon = formatted.reduce((sum, r) => sum + r.carbon_kg, 0);

    res.json({
      range: "last_7_days",
      total: {
        distance_km: roundNumber(totalDistance),
        carbon_kg: roundNumber(totalCarbon)
      },
      data: formatted
    });

  } catch (err) {
    console.error("Last 7 days error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
