import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    //dialect: "mysql",
    timezone: process.env.DB_TIMEZONE || "+05:30",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
      connectTimeout: 20000,
      timezone: process.env.DB_TIMEZONE || "+05:30"
    },
    logging: false
  }
);

export default sequelize;
