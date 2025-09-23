import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import visualizeRouter from "./routes/visualize.js";
import authRouter from "./routes/auth.js";
dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// 정적 파일 제공 (결과 URL용)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/public", express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_, res) => res.json({ ok: true }));

app.use("/", authRouter);
app.use("/", visualizeRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`server running http://localhost:${port}`));
