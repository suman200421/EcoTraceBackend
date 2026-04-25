import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const YearlyStat = sequelize.define(
  "YearlyStat",
  {
    year: {
      type: DataTypes.INTEGER,
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
    tableName: "yearly_stats",
    timestamps: false,
  }
);

export default YearlyStat;
