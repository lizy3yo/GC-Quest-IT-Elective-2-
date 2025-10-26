import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import jwt, { SignOptions, Secret } from "jsonwebtoken";

// Note: Do NOT import server-only modules (like your Mongoose models or bcrypt) at top-level.
// They will pull native bindings into the bundler. Lazy-load them inside callbacks.

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt", // keep session in JWT
  },
  callbacks: {
    // Keep your existing signIn flow (creates user in DB).
    async signIn({ account, user, profile }) {
      if (account?.provider === "google") {
        // Only allow emails from the Gordon College domain
        const allowedDomain = "@gordoncollege.edu.ph";
        const email = (profile?.email || "").toLowerCase();

        if (!email || !email.endsWith(allowedDomain)) {
          // Redirect back to the login page with reason so the page shows the error
          return "/auth/login?reason=domain";
        }

        // Lazy import server-only modules to avoid native-binding load at module-evaluation time
        const { connectToDatabase } = await import('@/lib/mongoose');
        const User = (await import('@/models/user')).default;

        await connectToDatabase();

        const existingUser = await User.findOne({
          email,
        });

        if (!existingUser) {
          // Create new user from Google profile — do NOT set a password
          const fullName = (profile?.name || '').trim();
          const [firstName, ...rest] = fullName.split(/\s+/);
          const lastName = rest.join(' ') || firstName || 'User';
          const usernameBase = (profile?.name || `user-${Date.now()}`).replace(/\s+/g, '').toLowerCase();
          const username = usernameBase.slice(0, 20); // respect schema maxLength

          const newUser = await User.create({
            username,
            email,
            firstName,
            lastName,
            // omit password for OAuth-only account
          });

          // Attach DB id to the NextAuth `user` object so jwt callback can mint tokens
          (user as any).id = newUser._id.toString();
        } else {
          (user as any).id = existingUser._id.toString();
        }
      }

      return true;
    },

    // jwt callback: run on sign in and on subsequent requests
    async jwt({ token, user, account }) {
      // On initial sign-in via provider, `user` will be set.
      if (user) {
        // Ensure we have a stable user id (set in signIn callback)
        const userId = (user as any).id || token.sub;

        // Create access and refresh tokens signed with your existing secrets
        const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.AUTH_SECRET || "dev_access_secret";
        const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.AUTH_SECRET || "dev_refresh_secret";

        const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || "1d";
        const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || "7d";

        try {
          const accessToken = jwt.sign(
            { userId },
            accessSecret as Secret,
            ({ expiresIn: accessExpiry } as SignOptions)
          );

          const refreshToken = jwt.sign(
            { userId },
            refreshSecret as Secret,
            ({ expiresIn: refreshExpiry } as SignOptions)
          );

          (token as any).accessToken = accessToken;
          (token as any).refreshToken = refreshToken;
          token.sub = userId;
          (token as any).user = user;
        } catch (err) {
          // swallow to avoid breaking NextAuth flow; logging can be added
          console.error("JWT sign error:", err);
        }
      }

      // return token for subsequent requests
      return token;
    },

    // session callback: expose tokens in session object (client can read via useSession())
    async session({ session, token }) {
      // Attach user id and tokens for client usage
      if (token?.sub) {
        (session as any).user = session.user || {};
        (session as any).user.id = token.sub;
      }
      if ((token as any)?.accessToken) (session as any).accessToken = (token as any).accessToken;
      if ((token as any)?.refreshToken) (session as any).refreshToken = (token as any).refreshToken;

      return session;
    },
  },
});




