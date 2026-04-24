import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const PendingUser = sequelize.define("PendingUser", {
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  middleName: {
    type: DataTypes.STRING,
    allowNull: true   // 👈 optional
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  otp: {
    type: DataTypes.STRING,
    allowNull: false
  },
  otpExpires: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: "pending_users"
});

export default PendingUser;
