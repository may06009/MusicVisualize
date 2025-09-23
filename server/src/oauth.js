import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as NaverStrategy } from "passport-naver-v2";
import dotenv from "dotenv";
import db from "./db.js";
import { signToken } from "./auth.js";
dotenv.config();

// 유저 upsert 헬퍼 (이메일 기준)
function upsertUserByEmail(email) {
  const row = db.prepare("SELECT id, email FROM users WHERE email = ?").get(email);
  if (row) return row;
  const info = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, ""); // 소셜계정은 pw 빈값
  return { id: info.lastInsertRowid, email };
}

passport.serializeUser((user, done) => done(null, user));   // 메모리에만 잠깐
passport.deserializeUser((obj, done) => done(null, obj));

/** Google */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("Google email missing"));
        const user = upsertUserByEmail(email);
        // 콜백에서 JWT를 발급할 수 있도록 user를 넘김
        return done(null, user);
      } catch (e) {
        return done(e);
      }
    }
  )
);

/** Naver */
passport.use(
  new NaverStrategy(
    {
      clientID: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
      callbackURL: process.env.NAVER_CALLBACK_URL
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        // 네이버는 profile.email 제공 설정 필요 (네이버 콘솔에서 '이메일' 동의)
        const email = profile.email;
        if (!email) return done(new Error("Naver email missing"));
        const user = upsertUserByEmail(email);
        return done(null, user);
      } catch (e) {
        return done(e);
      }
    }
  )
);

// 라우트 헬퍼: 콜백에서 우리 JWT 발급 후 프론트로 리다이렉트
export function sendJwtAndRedirect(req, res) {
  if (!req.user) return res.redirect(`${process.env.CLIENT_URL}/auth?error=oauth`);
  const token = signToken({ id: req.user.id, email: req.user.email });
  // 프론트의 콜백용 경로로 토큰 전달
  return res.redirect(`${process.env.CLIENT_URL}/oauth/callback?token=${token}`);
}

export default passport;
