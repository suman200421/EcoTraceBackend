import { QueryTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { toNumber, roundNumber } from "../stats/helpers.js";

export const getLast10YearsStats = async (req, res) => {
    try {
        const rows = await sequelize.query(
            `
      SELECT
        year as label,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM yearly_stats
      WHERE year >= YEAR(CURDATE()) - 9
      ORDER BY year ASC
      `,
            { type: QueryTypes.SELECT }
        );

        // 🔥 Fill missing years
        const resultMap = new Map(rows.map(r => [String(r.label), r]));

        const formatted = [];

        const currentYear = new Date().getFullYear();

        for (let i = 9; i >= 0; i--) {
            const year = currentYear - i;
            const yearStr = String(year);

            const row = resultMap.get(yearStr);

            formatted.push({
                label: yearStr,
                distance_km: toNumber(row?.distance_km),
                carbon_kg: toNumber(row?.carbon_kg)
            });
        }

        const totalDistance = formatted.reduce((sum, r) => sum + r.distance_km, 0);
        const totalCarbon = formatted.reduce((sum, r) => sum + r.carbon_kg, 0);

        res.json({
            range: "last_10_years",
            total: {
                distance_km: roundNumber(totalDistance),
                carbon_kg: roundNumber(totalCarbon)
            },
            data: formatted
        });

    } catch (err) {
        console.error("Last 10 years error:", err);
        res.status(500).json({ message: "Server error" });
    }
};