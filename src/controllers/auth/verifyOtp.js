import User from "../../models/User.js";
import PendingUser from "../../models/PendingUser.js";

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const pendingUser = await PendingUser.findOne({ where: { email } });

  if (!pendingUser) {
    return res.status(400).json({ message: "No pending registration found" });
  }

  if (pendingUser.otp !== otp)
    return res.status(400).json({ message: "Invalid OTP" });

  if (new Date() > pendingUser.otpExpires)
    return res.status(400).json({ message: "OTP expired" });

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  await User.create({
    firstName: pendingUser.firstName,
    middleName: pendingUser.middleName,
    lastName: pendingUser.lastName,
    email: pendingUser.email,
    password: pendingUser.password
  });

  await pendingUser.destroy();

  res.json({ message: "Account verified and created successfully" });
};
