import admin from "../../config/firebaseAdmin.js";
import User from "../../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken
} from "../../utils/token.js";
import dotenv from "dotenv";

dotenv.config();



const splitDisplayName = (name = "") => {
  if (!name) return { firstName: "", lastName: "" };
  const [firstName = "", ...lastNameParts] = name.trim().split(/\s+/);

  return {
    firstName,
    lastName: lastNameParts.join(" ")
  };
};

/**
 * POST /auth/google
 * Login through Google OAuth.
 * The frontend signs in with Google and sends the ID token here.
 */
export const googleLogin = async (req, res) => {
  try {
    const idToken = req.body.idToken || req.body.token;

    // --- Validate request ---
    if (!idToken) {
      return res.status(400).json({ message: "Firebase ID token is required" });
    }

    // --- Verify token with Firebase Admin ---
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (verifyErr) {
      console.error("Firebase token verification failed.");
      console.error("Error Code:", verifyErr.code);
      console.error("Error Message:", verifyErr.message);
      console.error("Full Error:", verifyErr);
      
      // Log token info safely for debugging
      const tokenPreview = typeof idToken === 'string' ? `${idToken.substring(0, 10)}...${idToken.substring(idToken.length - 10)}` : 'not a string';
      console.error(`Received token (length: ${idToken?.length || 0}): ${tokenPreview}`);

      return res.status(401).json({ 
        message: "Invalid Firebase ID token",
        debug: process.env.NODE_ENV === 'development' ? verifyErr.message : undefined
      });
    }

    const { email, name, picture, uid } = decodedToken;

    if (!email) {
      return res.status(401).json({ message: "Firebase token has no email" });
    }

    const providerId = uid; // Firebase's unique ID for the user
    const { firstName, lastName } = splitDisplayName(name);

    // --- Find or create user ---
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // New user - create with Google profile
      user = await User.create({
        email,
        firstName,
        lastName,
        password: null,
        provider: "google.com",
        providerId,
        avatar: picture || null
      });
    } else if (!user.providerId) {
      // Existing user without a linked provider - link account
      user.provider = "google.com";
      user.providerId = providerId;
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      await user.save();
    }
    // Else: user exists and already linked - proceed to login

    // --- Generate JWT tokens ---
    const accessToken = generateAccessToken(user.id, user.tokenVersion);
    const refreshToken = generateRefreshToken(user.id, user.tokenVersion);

    // --- Generate Firebase Custom Token ---
    let firebaseToken = null;
    try {
      firebaseToken = await admin.auth().createCustomToken(user.id.toString());
    } catch (tokenErr) {
      console.error("Failed to generate Firebase Custom Token:", tokenErr.message);
    }

    // Store refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // --- Response ---
    res.json({
      accessToken,
      refreshToken,
      firebaseToken,
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
