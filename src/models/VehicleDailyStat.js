import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const VehicleDailyStat = sequelize.define(
  "VehicleDailyStat",
  {
    date: {
      type: DataTypes.DATEONLY,
      primaryKey: true,
    },
    vehicle_type: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    total_distance_km: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    total_carbon_kg: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    user_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "vehicle_daily_stats",
    timestamps: false,
    indexes: [
      { fields: ["date"] },
      { fields: ["vehicle_type"] },
    ],
  }
);

export default VehicleDailyStat;
