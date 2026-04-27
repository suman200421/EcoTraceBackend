import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const VehicleMonthlyStat = sequelize.define(
  "VehicleMonthlyStat",
  {
    month: {
      type: DataTypes.STRING,
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
    tableName: "vehicle_monthly_stats",
    timestamps: false,
    indexes: [
      { fields: ["month"] },
      { fields: ["vehicle_type"] },
    ],
  }
);

export default VehicleMonthlyStat;
