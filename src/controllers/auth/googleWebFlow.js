import { OAuth2Client } from "google-auth-library";
import User from "../../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken
} from "../../utils/token.js";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_SCHEME = "ecotrace";

function hasGoogleWebConfig() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/**
 * Build the backend callback URL dynamically from the incoming request.
 */
function getCallbackUrl(req) {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return protocol + "://" + host + "/api/auth/google/callback";
}

/**
 * GET /api/auth/google/login
 * Redirects the user's browser to Google's consent screen.
 */
export const googleRedirect = (req, res) => {
  if (!hasGoogleWebConfig()) {
    return res.status(500).send("Google web OAuth is not configured");
  }

  const callbackUrl = getCallbackUrl(req);
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, callbackUrl);

  const authorizeUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "profile", "email"],
    prompt: "select_account",
    redirect_uri: callbackUrl,
  });

  res.redirect(authorizeUrl);
};

/**
 * GET /api/auth/google/callback
 * Google redirects here with ?code=...
 * Exchanges the code for tokens, finds/creates user,
 * and redirects back to the Expo app via its deep-link scheme.
 */
export const googleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    if (!hasGoogleWebConfig()) {
      return res.redirect(
        APP_SCHEME + "://auth-callback?error=" + encodeURIComponent("Google web OAuth is not configured")
      );
    }

    const callbackUrl = getCallbackUrl(req);
    const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, callbackUrl);

    // Exchange authorization code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, given_name, family_name, picture } = payload;

    if (!email) {
      return res.redirect(
        APP_SCHEME + "://auth-callback?error=" + encodeURIComponent("Google account has no email")
      );
    }

    // Find or create user
    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({
        email,
        firstName: given_name || "",
        lastName: family_name || "",
        password: null,
        provider: "google",
        providerId: sub,
        avatar: picture || null,
      });
    } else if (!user.providerId) {
      user.provider = "google";
      user.providerId = sub;
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      await user.save();
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken(user.id, user.tokenVersion);
    const refreshToken = generateRefreshToken(user.id, user.tokenVersion);

    user.refreshToken = refreshToken;
    await user.save();

    // Redirect back to the Expo app with tokens via deep link
    const deepLink =
      APP_SCHEME + "://auth-callback" +
      "?accessToken=" + encodeURIComponent(accessToken) +
      "&refreshToken=" + encodeURIComponent(refreshToken) +
      "&userId=" + encodeURIComponent(user.id);

    res.redirect(deepLink);
  } catch (err) {
    console.error("Google callback error:", err);
    res.redirect(
      APP_SCHEME + "://auth-callback?error=" + encodeURIComponent("Google login failed")
    );
  }
};
