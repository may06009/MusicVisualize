import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { requireAuth } from "../auth.js";
import { execFile } from "child_process";
import { promisify } from "util";

dotenv.config();

const pexecFile = promisify(execFile);
const router = Router();
const upload = multer({ dest: "uploads/" });

// 해커톤용 인메모리 잡 스토어
const jobs = new Map();

/**
 * 업로드 → job 생성 → (모델 실행) → /viz-data/<UUID>.json 반환
 *
 * .env 예시:
 *  MODEL_SCRIPT=C:/Users/PC/Desktop/model-ml/make_viz.py
 *  MODEL_CWD=C:/Users/PC/Desktop/model-ml
 *
 * 콘다 프롬프트에서:
 *  conda activate MusicVisualize
 *  (같은 창에서) npm run dev
 */
router.post("/visualize", requireAuth, upload.single("audio_file"), async (req, res) => {
  const jobId = uuidv4();
  jobs.set(jobId, { status: "running", result: null, error: null });

  const localAudioPath = req.file?.path; // 예: uploads\xxxx
  if (!localAudioPath) return res.status(400).json({ error: "audio_file is required" });

  (async () => {
    try {
      // ✅ 절대경로로 변환 (model-ml에서 실행해도 안전)
      const absAudio = path.resolve(localAudioPath);
      const outdir = path.resolve(process.cwd(), "public", "viz-data");

      if (!fs.existsSync(absAudio)) throw new Error(`audio not found: ${absAudio}`);
      if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

      const script = process.env.MODEL_SCRIPT; // C:/Users/PC/Desktop/model-ml/make_viz.py
      const cwd = process.env.MODEL_CWD || process.cwd(); // C:/Users/PC/Desktop/model-ml
      if (!script) throw new Error("MODEL_SCRIPT is not set in .env");

      // 콘다 프롬프트에서 서버 실행 중이라면 "python"이 해당 환경의 파이썬
      const args = [script, "--audio", absAudio, "--outdir", outdir];

      // (필요시) 실제 실행 커맨드 확인
      // console.log("[viz] python", args.join(" "), "cwd:", cwd);

      const { stdout, stderr } = await pexecFile("python", args, { cwd });

      const vid = (stdout || "").trim(); // 모델이 출력한 UUID
      if (!vid) throw new Error(`Empty stdout from model. stderr=${stderr || ""}`);

      const jsonPath = path.join(outdir, `${vid}.json`);
      if (!fs.existsSync(jsonPath)) throw new Error(`viz json not found: ${jsonPath}`);

      // 프론트에서 바로 접근 가능한 URL (index.js에 /viz-data 정적 서빙 필요)
      jobs.set(jobId, {
        status: "done",
        result: {
          type: "json",
          mime: "application/json",
          url: `/viz-data/${vid}.json`,
          meta: { model: "make_viz.py", vid }
        },
        error: null
      });
    } catch (e) {
      jobs.set(jobId, { status: "failed", result: null, error: { message: String(e) } });
    } finally {
      const keep = String(process.env.KEEP_UPLOADS || "0") === "1";
      if (!keep){
        try { fs.unlinkSync(localAudioPath); } catch {}
      }
    }
  })();

  // 즉시 job_id 반환 (프론트는 /jobs/:id 폴링)
  res.json({ job_id: jobId });
});

/** 상태/결과 조회 */
router.get("/jobs/:id", requireAuth, (req, res) => {
  console.log("[/jobs]", req.params.id, "auth user:", req.user);
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  return res.json({ job_id: req.params.id, ...job });
});

export default router;
