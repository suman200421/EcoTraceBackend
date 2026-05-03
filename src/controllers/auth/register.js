import bcrypt from "bcrypt";
import User from "../../models/User.js";
import PendingUser from "../../models/PendingUser.js";
import transporter, { sendEmailWithRetry } from "../../config/mail.js";

const PASSWORD_SALT_ROUNDS = 12;

export const register = async (req, res) => {
  try {
    const { firstName, middleName, lastName, email, password } = req.body;
    console.log(req.body);

    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    let pendingUser = await PendingUser.findOne({ where: { email } });

    if (pendingUser) {
      pendingUser.password = hashedPassword;
      pendingUser.otp = otp;
      pendingUser.otpExpires = otpExpires;
      await pendingUser.save();
    } else {
      await PendingUser.create({
        firstName,
        middleName,
        lastName,
        email,
        password: hashedPassword,
        otp,
        otpExpires
      });
    }

    // Send email asynchronously with retry (non-blocking)
    await sendEmailWithRetry({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Verification OTP",
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
      `
    }).catch(error => {
      console.error("Email sending failed after retries:", error.message);
      // Log but don't fail the registration - OTP is already saved
    });

    res.status(201).json({
      message: "OTP sent to your email. Please check your inbox."
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
