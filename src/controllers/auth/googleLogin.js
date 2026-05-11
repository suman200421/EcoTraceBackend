import admin from "../../config/firebaseAdmin.js";
import User from "../../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken
} from "../../utils/token.js";

const splitDisplayName = (name = "") => {
  const [firstName = "", ...lastNameParts] = name.trim().split(/\s+/);

  return {
    firstName,
    lastName: lastNameParts.join(" ")
  };
};

/**
 * POST /auth/google
 * Login through Firebase Auth.
 * The frontend signs in with Firebase, then sends the Firebase ID token here.
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
      return res.status(401).json({ message: "Invalid Firebase ID token" });
    }

    const email = decodedToken.email;

    if (!email) {
      return res.status(401).json({ message: "Firebase account has no email" });
    }

    const signInProvider = decodedToken.firebase?.sign_in_provider || "firebase";
    const providerIds = decodedToken.firebase?.identities?.["google.com"] || [];
    const providerId = providerIds[0] || decodedToken.uid;
    const { firstName, lastName } = splitDisplayName(decodedToken.name);

    // --- Find or create user ---
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // New user - create with Firebase Google profile
      user = await User.create({
        email,
        firstName,
        lastName,
        password: null,
        provider: signInProvider,
        providerId,
        avatar: decodedToken.picture || null
      });
    } else if (!user.providerId) {
      // Existing user without a Firebase-linked provider - link account
      user.provider = signInProvider;
      user.providerId = providerId;
      if (decodedToken.picture && !user.avatar) {
        user.avatar = decodedToken.picture;
      }
      await user.save();
    }
    // Else: user exists and already linked - proceed to login

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
