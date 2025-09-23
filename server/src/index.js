import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import cookieParser from "cookie-parser";

import visualizeRouter from "./routes/visualize.js";
import authRouter from "./routes/auth.js";
import passport, { sendJwtAndRedirect } from "./oauth.js";

dotenv.config();

const app = express();

/** CORS: 프론트 도메인만 허용 */
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

/** JSON 파서 & 쿠키 */
app.use(express.json());
app.use(cookieParser());

/** OAuth 콜백까지 유지할 임시 세션 (JWT는 콜백 후 발급하여 프론트로 전달) */
app.use(
  session({
    secret: process.env.JWT_SECRET || "dev",
    resave: false,
    saveUninitialized: false,
  })
);

/** Passport 초기화 */
app.use(passport.initialize());
app.use(passport.session());

/** 정적 파일 제공 (/public 하위는 결과 URL로 접근 가능) */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/public", express.static(path.join(__dirname, "..", "public")));

// ✅ viz-data 폴더만 별도로 마운트 (캐시 헤더는 선택)
const vizDir = path.join(__dirname, "..", "public", "viz-data");

app.use(
  "/viz-data",
  express.static(vizDir, {
    maxAge: "1h", // 선택: 브라우저 캐시
    // setHeaders: (res) => { res.setHeader("Cache-Control", "public, max-age=3600"); },
  })
);

/** 헬스체크 */
app.get("/health", (_, res) => res.json({ ok: true }));

/** --- OAuth: Google --- */
app.get(
  "/oauth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/oauth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/auth?error=google`,
  }),
  sendJwtAndRedirect
);

/** --- OAuth: Naver --- */
app.get("/oauth/naver", passport.authenticate("naver", { authType: "reprompt" }));
app.get(
  "/oauth/naver/callback",
  passport.authenticate("naver", {
    failureRedirect: `${process.env.CLIENT_URL}/auth?error=naver`,
  }),
  sendJwtAndRedirect
);

/** 기존 API */
app.use("/", authRouter);
app.use("/", visualizeRouter);

/** 서버 시작 */
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`server running http://localhost:${port}`));
