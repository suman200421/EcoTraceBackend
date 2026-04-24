import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findByPk(decoded.userId);
    const tokenVersion = decoded.tokenVersion ?? 0;


    console.log("DECODED:", decoded);
    console.log("USER tokenVersion:", user?.tokenVersion);
    
    if (!user || tokenVersion !== user.tokenVersion) {
      return res.sendStatus(403);
    }

    req.userId = user.id;
    next();
  } catch (err) {
    return res.sendStatus(403);
  }
};
