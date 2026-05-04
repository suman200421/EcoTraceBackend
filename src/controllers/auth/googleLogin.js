import { OAuth2Client } from "google-auth-library";
import User from "../../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken
} from "../../utils/token.js";
import dotenv from "dotenv";

dotenv.config();

const client = new OAuth2Client();

/**
 * Verify Google ID token and extract user payload.
 * Accepts tokens issued for Web, Android, and Expo client IDs.
 */
const verifyGoogleToken = async (idToken) => {
  const allowedAudiences = [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID
  ].filter(Boolean);

  const ticket = await client.verifyIdToken({
    idToken,
    audience: allowedAudiences
  });

  return ticket.getPayload();
};

/**
 * POST /auth/google
 * Google OAuth login — verifies ID token sent from frontend (Expo / Android / Web).
 */
export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    // --- Validate request ---
    if (!idToken) {
      return res.status(400).json({ message: "Google ID token is required" });
    }

    // --- Verify token with Google ---
    let payload;
    try {
      payload = await verifyGoogleToken(token);
    } catch (verifyErr) {
      return res.status(401).json({ message: "Invalid Google ID token" });
    }

    const { sub, email, given_name, family_name, picture } = payload;

    if (!email) {
      return res.status(401).json({ message: "Google account has no email" });
    }

    // --- Find or create user ---
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // New user — create with Google profile
      user = await User.create({
        email,
        firstName: given_name || "",
        lastName: family_name || "",
        password: null,
        provider: "google",
        providerId: sub,
        avatar: picture || null
      });
    } else if (!user.providerId) {
      // Existing user without Google linked — link account
      user.provider = "google";
      user.providerId = sub;
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      await user.save();
    }
    // Else: user exists and already linked — proceed to login

    // --- Generate JWT tokens ---
    const accessToken = generateAccessToken(user.id, user.tokenVersion);
    const refreshToken = generateRefreshToken(user.id, user.tokenVersion);

    // Store refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // --- Response ---
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        provider: user.provider,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(500).json({ message: "Server error during Google login" });
  }
};
