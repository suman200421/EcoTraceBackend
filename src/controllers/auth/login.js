import bcrypt from "bcrypt";
import User from "../../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken
} from "../../utils/token.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    // Reject password login for OAuth-only accounts
    if (!user.password) {
      return res.status(401).json({ message: "This account uses Google login. Please sign in with Google." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user.id, user.tokenVersion);
    const refreshToken = generateRefreshToken(user.id, user.tokenVersion);

    user.refreshToken = refreshToken;
    await user.save();

    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
