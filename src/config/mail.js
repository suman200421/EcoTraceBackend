import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Send email with retry logic
export const sendEmailWithRetry = async (mailOptions, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await resend.emails.send({
        from: mailOptions.from || "onboarding@resend.dev", // Replace with your verified sender
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      console.log(`Email sent successfully on attempt ${attempt}:`, result.data.id);
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

export default resend;
