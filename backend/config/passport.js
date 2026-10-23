import passport from "passport";
import googleOauth20 from "passport-google-oauth20";
import User from "../models/User.js";

const GoogleStrategy = googleOauth20.Strategy || googleOauth20;

// Google OAuth is optional: the server still runs (and local auth still works)
// when the Google credentials are not provided.
export const isGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

// configurePassport
// Registers the Google strategy. The verify callback finds an existing user by
// googleId or email (linking the Google account), or creates a new Google user.
export function configurePassport() {
  if (!isGoogleConfigured) {
    console.warn(
      "[Passport] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google login is disabled."
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase().trim();
          const avatar = profile.photos?.[0]?.value || "";

          let user = await User.findOne({
            $or: [{ googleId: profile.id }, ...(email ? [{ email }] : [])],
          });

          if (user) {
            // Link Google account to an existing (local or google) user.
            user.googleId = profile.id;
            if (!user.avatar && avatar) user.avatar = avatar;
            if (!user.name && profile.displayName) user.name = profile.displayName;
            await user.save();
          } else {
            user = await User.create({
              name: profile.displayName || (email ? email.split("@")[0] : "Google User"),
              email,
              provider: "google",
              googleId: profile.id,
              avatar,
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  console.log("[Passport] Google OAuth strategy registered.");
}
