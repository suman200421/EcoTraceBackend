import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use TLS instead of SSL
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 15000,
  socketTimeout: 15000,
  pool: {
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 2000,
    rateLimit: 10
  }
});

// Retry utility for failed emails
export const sendEmailWithRetry = async (mailOptions, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.error(`Email send attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error(`Email delivery failed after ${maxRetries} attempts`);
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delayMs = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

export default transporter;
