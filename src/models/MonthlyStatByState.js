import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const MonthlyStatByState = sequelize.define(
  "MonthlyStatByState",
  {
    month: {
      type: DataTypes.STRING,
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
  },
  {
    tableName: "monthly_stats_by_state",
    timestamps: false,
  }
);

export default MonthlyStatByState;
