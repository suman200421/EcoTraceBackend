import app from "./app.js";
import sequelize from "./config/db.js";
import dotenv from "dotenv";
import swaggerDocs from '../swagger.js';
import cron from "node-cron";
import "./models/User.js";
import "./models/PendingUser.js";
import "./models/DailyVehicleStat.js";
import "./models/GlobalDailyStat.js";
import "./models/WeeklyStat.js";
import "./models/MonthlyStat.js";
import "./models/YearlyStat.js";
import "./models/GlobalDailyStatByState.js";
import "./models/WeeklyStatByState.js";
import "./models/MonthlyStatByState.js";
import "./models/YearlyStatByState.js";
import "./models/VehicleDailyStat.js";
import "./models/VehicleWeeklyStat.js";
import "./models/VehicleMonthlyStat.js";
import "./models/VehicleYearlyStat.js";

dotenv.config();

const PORT = process.env.PORT;

(async () => {
  try {
    await sequelize.authenticate();
    // await sequelize.sync();
    await sequelize.sync();

    console.log("PostgreSQL connected");

    //DB cron Job to keep the connection alive
    cron.schedule("*/5 * * * *", async () => {
      try {
        await sequelize.query("SELECT 1");
        console.log("DB kept alive");
      } catch (err) {
        console.error("Keep-alive failed:", err);
      }
    });
    
    app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );
    swaggerDocs(app, PORT);
  } catch (err) {
    console.error("Unable to connect:", err);
  }
})();
