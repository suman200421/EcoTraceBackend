import app from "./app.js";
import sequelize from "./config/db.js";
import dotenv from "dotenv";
import swaggerDocs from '../swagger.js';
import cron from "node-cron";
import "./models/User.js";
import "./models/PendingUser.js";
import "./models/DailyVehicleStat.js";

dotenv.config();

const PORT = process.env.PORT;

(async () => {
  try {
    await sequelize.authenticate();
    // await sequelize.sync();
    await sequelize.sync();

    console.log("MySQL connected");

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
