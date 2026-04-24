import bcrypt from "bcrypt";
import crypto from "crypto";
import User from "../../models/User.js";

const PASSWORD_SALT_ROUNDS = 12;

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return res.status(400).json({ message: "Token and new password are required" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({ where: { resetToken: hashedToken } });

    if (!user || !user.resetTokenExpiry || new Date() > user.resetTokenExpiry)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshToken = null;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
