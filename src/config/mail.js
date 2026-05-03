import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 10000, // 10 seconds
  socketTimeout: 10000, // 10 seconds
  pool: {
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 2000,
    rateLimit: 14 // max 14 messages per 2 seconds
  }
});

export default transporter;
