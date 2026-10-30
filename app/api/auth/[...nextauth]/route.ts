import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { queryD1 } from "@/lib/d1";
import { supabase } from "@/lib/supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "ชื่อผู้ใช้ (Username)", type: "text", placeholder: "username" },
        password: { label: "รหัสผ่าน (Password)", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
        }

        const username = credentials.username.trim();
        const password = credentials.password.trim();

        // 1. Master Admin Bypass / Fallback (Always works)
        if (
          (username.toLowerCase() === "admin" || username.toLowerCase() === "superadmin") &&
          (password === "029030445Rd*" || password === "admin1234" || password === "admin")
        ) {
          return {
            id: "1",
            name: "ผู้ดูแลระบบสูงสุด (Master Admin)",
            username: "admin",
            job_position: "Admin",
            allowed_regions: ["All"],
            allowed_provinces: ["All"],
            can_download: true,
            can_screen_capture: true,
          } as any;
        }

        // 2. Query user from Cloudflare D1 'users' table (Zero Egress)
        try {
          const d1Users = await queryD1(
            `SELECT id, username, password, fullname, job_position, can_download, can_screen_capture 
             FROM users 
             WHERE LOWER(username) = LOWER(?) 
             LIMIT 1`,
            [username]
          );

          if (d1Users && d1Users.length > 0) {
            const user = d1Users[0];
            if (user.password === password) {
              return {
                id: user.id?.toString() || user.username,
                name: user.fullname || user.username,
                username: user.username,
                job_position: user.job_position || "SalesRep",
                allowed_regions: ["All"],
                allowed_provinces: ["All"],
                can_download: Boolean(user.can_download),
                can_screen_capture: Boolean(user.can_screen_capture),
              } as any;
            }
          }
        } catch (d1Err) {
          console.warn("Cloudflare D1 auth error, falling back:", d1Err);
        }

        // 3. Fallback: Query user from Supabase 'users' table
        try {
          const { data: user, error } = await supabase
            .from("users")
            .select("id, username, password, fullname, job_position, allowed_regions, allowed_provinces, can_download, can_screen_capture")
            .ilike("username", username)
            .single();

          if (user && !error) {
            const isMatch = user.password === password;
            if (isMatch) {
              return {
                id: user.id?.toString() || user.username,
                name: user.fullname || user.username,
                username: user.username,
                job_position: user.job_position || "SalesRep",
                allowed_regions: user.allowed_regions || [],
                allowed_provinces: user.allowed_provinces || [],
                can_download: Boolean(user.can_download),
                can_screen_capture: Boolean(user.can_screen_capture),
              } as any;
            }
          }
        } catch (dbErr) {}

        throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.job_position = (user as any).job_position;
        token.allowed_regions = (user as any).allowed_regions;
        token.allowed_provinces = (user as any).allowed_provinces;
        token.can_download = (user as any).can_download;
        token.can_screen_capture = (user as any).can_screen_capture;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).job_position = token.job_position;
        (session.user as any).allowed_regions = token.allowed_regions;
        (session.user as any).allowed_provinces = token.allowed_provinces;
        (session.user as any).can_download = token.can_download;
        (session.user as any).can_screen_capture = token.can_screen_capture;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "ROYAL_D_SECRET_KEY_SUPER_SECURE_2026_@RD*",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
