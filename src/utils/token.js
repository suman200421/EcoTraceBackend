import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const generateAccessToken = (userId, tokenVersion = 0) => {
  return jwt.sign(
    { userId, tokenVersion },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRE }
  );
};

export const generateRefreshToken = (userId, tokenVersion = 0) => {
  return jwt.sign(
    { userId, tokenVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE }
  );
};
