import { QueryTypes } from "sequelize";
import sequelize from "../../../config/db.js";
import { VALID_RANGES, toNumber, roundNumber } from "../../stats/helpers.js";

export const getVehicleStats = async (req, res) => {
  try {
    const { range = "daily" } = req.query;

    if (!VALID_RANGES.has(range)) {
      return res.status(400).json({ message: "Invalid range parameter" });
    }

    let tableName;
    switch (range) {
      case "weekly":
        tableName = "vehicle_weekly_stats";
        break;
      case "monthly":
        tableName = "vehicle_monthly_stats";
        break;
      case "yearly":
        tableName = "vehicle_yearly_stats";
        break;
      case "daily":
      default:
        tableName = "vehicle_daily_stats";
        break;
    }

    const query = `
      SELECT 
        vehicle_type, 
        SUM(total_distance_km) AS distance_km, 
        SUM(total_carbon_kg) AS carbon_kg, 
        SUM(user_count) AS user_count 
      FROM ${tableName} 
      GROUP BY vehicle_type
      ORDER BY distance_km DESC
    `;

    const results = await sequelize.query(query, {
      type: QueryTypes.SELECT
    });

    let totalDistanceKm = 0;
    let totalCarbonKg = 0;
    let totalUserCount = 0;

    const parsedResults = results.map(row => {
      const distance = toNumber(row.distance_km);
      const carbon = toNumber(row.carbon_kg);
      const users = toNumber(row.user_count);

      totalDistanceKm += distance;
      totalCarbonKg += carbon;
      totalUserCount += users;

      return {
        type: row.vehicle_type || "unknown",
        distance_km: distance,
        carbon_kg: carbon,
        user_count: users
      };
    });

    // Calculate percentages
    for (const vehicle of parsedResults) {
      vehicle.percentage = totalDistanceKm > 0 
        ? roundNumber((vehicle.distance_km / totalDistanceKm) * 100) 
        : 0;
    }

    // Group into top 4 + "others" if there are more than 4
    let finalVehicles = [];
    if (parsedResults.length > 4) {
      finalVehicles = parsedResults.slice(0, 4);
      const others = parsedResults.slice(4);
      
      const othersDistance = others.reduce((sum, v) => sum + v.distance_km, 0);
      const othersCarbon = others.reduce((sum, v) => sum + v.carbon_kg, 0);
      const othersUsers = others.reduce((sum, v) => sum + v.user_count, 0);
      const othersPercentage = totalDistanceKm > 0 
        ? roundNumber((othersDistance / totalDistanceKm) * 100)
        : 0;

      finalVehicles.push({
        type: "others",
        distance_km: roundNumber(othersDistance),
        carbon_kg: roundNumber(othersCarbon),
        user_count: Math.round(othersUsers),
        percentage: othersPercentage
      });
    } else {
      finalVehicles = parsedResults;
    }

    // Rounding all numeric values in final objects just to be clean
    finalVehicles = finalVehicles.map(v => ({
      ...v,
      distance_km: roundNumber(v.distance_km),
      carbon_kg: roundNumber(v.carbon_kg)
    }));

    return res.json({
      range,
      total: {
        distance_km: roundNumber(totalDistanceKm),
        carbon_kg: roundNumber(totalCarbonKg),
        user_count: Math.round(totalUserCount)
      },
      vehicles: finalVehicles
    });
  } catch (err) {
    console.error("Get vehicle stats error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
