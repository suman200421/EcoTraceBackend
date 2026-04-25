import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import statsRoutes from "./routes/stats.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/cron/ping', (req, res) => {
  console.log('Cron triggered');
  res.send('OK');
});

app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);

export default app;
