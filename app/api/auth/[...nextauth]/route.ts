import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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

        // Query user from Supabase 'users' table
        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("username", credentials.username.trim())
          .single();

        if (error || !user) {
          throw new Error("ไม่พบบัญชีผู้ใช้นี้ในระบบ");
        }

        // Verify password (plain text or check against DB password)
        const isMatch = user.password === credentials.password;
        if (!isMatch) {
          throw new Error("รหัสผ่านไม่ถูกต้อง");
        }

        // Return user object containing permissions and profile
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
      if (session.user) {
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
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  secret: process.env.NEXTAUTH_SECRET || "ROYAL_D_SECRET_KEY_SUPER_SECURE_2026_@RD*",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
