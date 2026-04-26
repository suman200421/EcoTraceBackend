import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const GlobalDailyStatByState = sequelize.define(
  "GlobalDailyStatByState",
  {
    date: {
      type: DataTypes.DATEONLY,
      primaryKey: true,
    },
    state: {
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
    tableName: "global_daily_stats_by_state",
    timestamps: false,
  }
);

export default GlobalDailyStatByState;
