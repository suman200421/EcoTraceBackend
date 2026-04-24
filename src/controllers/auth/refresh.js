import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import { generateAccessToken } from "../../utils/token.js";

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.sendStatus(401);

    const user = await User.findOne({ where: { refreshToken } });
    if (!user) return res.sendStatus(403);

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.sendStatus(403);
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    if (!decoded || decoded.userId !== user.id || tokenVersion !== user.tokenVersion)
      return res.sendStatus(403);

    const newAccessToken = generateAccessToken(user.id, user.tokenVersion);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
