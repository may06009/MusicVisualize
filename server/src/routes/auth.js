import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../db.js";
import { signToken, requireAuth } from "../auth.js";

const router = Router();

// 회원가입
router.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (password.length < 6) return res.status(400).json({ error: "password must be >= 6 chars" });

    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");
    try {
      const info = stmt.run(email, hash);
      const token = signToken({ id: info.lastInsertRowid, email });
      return res.json({ token, user: { id: info.lastInsertRowid, email } });
    } catch (e) {
      if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "email already exists" });
      }
      throw e;
    }
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
});

// 로그인
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    const row = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email);
    if (!row) return res.status(401).json({ error: "invalid credentials" });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = signToken({ id: row.id, email: row.email });
    return res.json({ token, user: { id: row.id, email: row.email } });
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
});

// 내 정보
router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: { id: req.user.id, email: req.user.email } });
});

export default router;
