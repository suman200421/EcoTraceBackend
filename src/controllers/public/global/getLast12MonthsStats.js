import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { toNumber, roundNumber } from "../../stats/helpers.js";

export const getLast12MonthsStats = async (req, res) => {
    try {
        const rows = await sequelize.query(
            `
      SELECT
        month as label,
        total_distance_km as distance_km,
        total_carbon_kg as carbon_kg
      FROM monthly_stats
      WHERE month >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m')
      ORDER BY month ASC
      `,
            { type: QueryTypes.SELECT }
        );

        // 🔥 Fill missing months
        const resultMap = new Map(rows.map(r => [r.label, r]));

        const formatted = [];

        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const monthStr = `${year}-${month}`;

            const row = resultMap.get(monthStr);

            formatted.push({
                label: monthStr,
                distance_km: toNumber(row?.distance_km),
                carbon_kg: toNumber(row?.carbon_kg)
            });
        }

        const totalDistance = formatted.reduce((sum, r) => sum + r.distance_km, 0);
        const totalCarbon = formatted.reduce((sum, r) => sum + r.carbon_kg, 0);

        res.json({
            range: "last_12_months",
            total: {
                distance_km: roundNumber(totalDistance),
                carbon_kg: roundNumber(totalCarbon)
            },
            data: formatted
        });

    } catch (err) {
        console.error("Last 12 months error:", err);
        res.status(500).json({ message: "Server error" });
    }
};