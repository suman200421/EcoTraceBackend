import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const MonthlyStat = sequelize.define(
  "MonthlyStat",
  {
    month: {
      type: DataTypes.STRING(7),
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
    tableName: "monthly_stats",
    timestamps: false,
  }
);

export default MonthlyStat;
