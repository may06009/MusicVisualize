import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { requireAuth } from "../auth.js";
dotenv.config();

const router = Router();
const upload = multer({ dest: "uploads/" });

// 메모리 job 스토어(해커톤용)
const jobs = new Map();

/**
 * 업로드 → job 생성
 */
router.post("/visualize", requireAuth, upload.single("audio_file"), async (req, res) => {
  const jobId = uuidv4();
  jobs.set(jobId, { status: "running", result: null, error: null });

  // 가짜 처리: 1~2초 뒤에 "URL 방식 결과" 확정
  setTimeout(() => {
    const outDir = process.env.STORAGE_DIR || "public/results";
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 샘플 썸네일/이미지 생성(복사) – 초기엔 저장소에 기본 파일 하나 넣어두기
    // 없으면 간단히 placeholder PNG를 만들어도 됨.
    const sampleSrc = path.join("public", "sample.png");
    const target = path.join(outDir, `${jobId}.png`);

    try {
      // 샘플 파일이 있다면 복사, 없으면 단순히 존재 체크만 패스
      if (fs.existsSync(sampleSrc)) fs.copyFileSync(sampleSrc, target);

      const publicUrl = `/public/results/${jobId}.png`; // URL 방식 핵심!
      jobs.set(jobId, {
        status: "done",
        result: {
          type: "image",
          mime: "image/png",
          url: publicUrl,
          poster: null,
          meta: { duration_sec: 0, model: "stub-url-v1" }
        },
        error: null
      });
    } catch (e) {
      jobs.set(jobId, { status: "failed", result: null, error: { message: e.message } });
    }
  }, 1200);

  res.json({ job_id: jobId });
});

/**
 * 상태/결과 조회
 */
router.get("/jobs/:id", requireAuth, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  return res.json({ job_id: req.params.id, ...job });
});

export default router;
