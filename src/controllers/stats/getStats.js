import { QueryTypes } from "sequelize";
import sequelize from "../../config/db.js";
import { VALID_RANGES, getDateRange, toNumber, roundNumber } from "./helpers.js";

export const getStats = async (req, res) => {
  try {
    const { range = "daily" } = req.query;

    if (!VALID_RANGES.has(range)) {
      return res.status(400).json({ message: "Invalid range" });
    }

    const { startDate, endDate } = getDateRange(range);

    const rows = await sequelize.query(
      `
        SELECT
          vehicle_type,
          SUM(distance_km) AS distance_km,
          SUM(carbon_kg) AS carbon_kg
        FROM daily_vehicle_stats
        WHERE user_id = :userId
          AND date BETWEEN :startDate AND :endDate
        GROUP BY vehicle_type
      `,
      {
        replacements: {
          userId: req.userId,
          startDate,
          endDate
        },
        type: QueryTypes.SELECT
      }
    );

    const vehicles = rows
      .map((row) => ({
        type: row.vehicle_type,
        distance_km: toNumber(row.distance_km),
        carbon_kg: toNumber(row.carbon_kg)
      }))
      .sort((a, b) => b.distance_km - a.distance_km);

    const totalDistance = vehicles.reduce((sum, vehicle) => sum + vehicle.distance_km, 0);
    const totalCarbon = vehicles.reduce((sum, vehicle) => sum + vehicle.carbon_kg, 0);

    const responseVehicles = vehicles.map((vehicle) => ({
      type: vehicle.type,
      distance_km: roundNumber(vehicle.distance_km),
      carbon_kg: roundNumber(vehicle.carbon_kg),
      percentage:
        totalDistance === 0
          ? 0
          : roundNumber((vehicle.distance_km / totalDistance) * 100)
    }));

    let groupedVehicles = responseVehicles;

    if (responseVehicles.length > 4) {
      const topVehicles = responseVehicles.slice(0, 4);
      const remainingVehicles = responseVehicles.slice(4);
      const othersDistance = remainingVehicles.reduce(
        (sum, vehicle) => sum + vehicle.distance_km,
        0
      );
      const othersCarbon = remainingVehicles.reduce(
        (sum, vehicle) => sum + vehicle.carbon_kg,
        0
      );

      groupedVehicles = [
        ...topVehicles,
        {
          type: "others",
          distance_km: roundNumber(othersDistance),
          carbon_kg: roundNumber(othersCarbon),
          percentage:
            totalDistance === 0
              ? 0
              : roundNumber((othersDistance / totalDistance) * 100)
        }
      ];
    }

    res.json({
      range,
      start_date: startDate,
      end_date: endDate,
      total: {
        distance_km: roundNumber(totalDistance),
        carbon_kg: roundNumber(totalCarbon)
      },
      vehicles: groupedVehicles
    });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
