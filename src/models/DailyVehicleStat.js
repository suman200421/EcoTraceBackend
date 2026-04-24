import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const DailyVehicleStat = sequelize.define(
  "DailyVehicleStat",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    vehicle_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    distance_km: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    carbon_kg: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    trip_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  },
  {
    tableName: "daily_vehicle_stats",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        name: "daily_vehicle_stats_user_date_vehicle_unique",
        fields: ["user_id", "date", "vehicle_type"]
      },
      {
        name: "daily_vehicle_stats_user_date_idx",
        fields: ["user_id", "date"]
      },
      {
        name: "daily_vehicle_stats_user_vehicle_type_idx",
        fields: ["user_id", "vehicle_type"]
      },
      {
        name: "daily_vehicle_stats_state_idx",
        fields: ["state"]
      }
    ]
  }
);

export default DailyVehicleStat;
