import crypto from "crypto";
import User from "../../models/User.js";
import transporter from "../../config/mail.js";

const RESET_TOKEN_EXPIRY_MINUTES = 15;
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ where: { email } });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

      user.resetToken = hashedToken;
      user.resetTokenExpiry = resetTokenExpiry;
      await user.save();

      const resetUrl = `${process.env.CLIENT_URL || "https://yourapp.com"}/reset-password?token=${resetToken}`;

      // Send email asynchronously (non-blocking)
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset Request",
        html: `
          <h2>Password Reset Request</h2>
          <p>If you requested a password reset, click the link below to set a new password. This link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.</p>
          <p><a href="${resetUrl}">Reset your password</a></p>
          <p>If you did not request this, you can safely ignore this email.</p>
        `
      }, (error, info) => {
        if (error) {
          console.error("Password reset email failed:", error);
        } else {
          console.log("Password reset email sent:", info.response);
        }
      });
    }

    res.json({ message: "If account exists, email sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
