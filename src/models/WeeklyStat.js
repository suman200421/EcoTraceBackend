import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const WeeklyStat = sequelize.define(
  "WeeklyStat",
  {
    week_start: {
      type: DataTypes.DATEONLY,
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
  },
  {
    tableName: "weekly_stats",
    timestamps: false,
  }
);

export default WeeklyStat;
