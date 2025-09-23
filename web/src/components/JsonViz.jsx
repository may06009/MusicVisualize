// JsonViz.jsx — make_viz.py 스키마 100% 호환 + 오디오 동기 + 스파클 + 비트-링
import { useEffect, useRef, useState, useMemo } from "react";

/* ---------- utils ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function toPairs(arrOrPairs = []) {
  if (!arrOrPairs || !arrOrPairs.length) return [];
  if (typeof arrOrPairs[0] === "number") {
    const N = arrOrPairs.length;
    return arrOrPairs.map((v, i) => ({ t: i / Math.max(1, N - 1), v }));
  }
  return arrOrPairs.map(p => ({ t: Number(p.t), v: Number(p.v) })).sort((a,b)=>a.t-b.t);
}
function samplePairs(pairs, t) {
  if (!pairs.length) return 0;
  if (t <= pairs[0].t) return pairs[0].v;
  if (t >= pairs[pairs.length - 1].t) return pairs[pairs.length - 1].v;
  let i = 1;
  while (i < pairs.length && pairs[i].t < t) i++;
  const p0 = pairs[i - 1], p1 = pairs[i];
  const u = (t - p0.t) / Math.max(1e-6, (p1.t - p0.t));
  return lerp(p0.v, p1.v, u);
}
function normalizeSections(sections = [], duration = 0) {
  if (!sections.length) return [];
  if ("start" in sections[0]) return sections; // {start,end,label}
  // [{end}] → {start,end,label}
  const out = [];
  let prev = 0;
  for (let i = 0; i < sections.length; i++) {
    const end = Number(sections[i].end);
    out.push({ start: prev, end, label: String.fromCharCode(65 + i) });
    prev = end;
  }
  if (out[out.length - 1].end < duration) out[out.length - 1].end = duration;
  return out;
}
function toPalette(pal, theme="pastel") {
  if (Array.isArray(pal)) return pal;
  if (pal && typeof pal === "object") {
    const keys = Object.keys(pal).sort((a,b)=>Number(a)-Number(b));
    return keys.map(k => pal[k]);
  }
  const THEMES = {
    pastel: ["#a1c4fd","#c2e9fb","#ffdde1","#b8c6db","#f5f7fa"],
    neon:   ["#00F5D4","#9B5DE5","#F15BB5","#FEE440","#00BBF9"],
    sunset: ["#0b132b","#1c2541","#3a506b","#5bc0be","#f2b5d4"],
  };
  return THEMES[theme] || THEMES.pastel;
}
function hexToRgb(hex) {
  if (!hex) return "255,255,255";
  const m = hex.replace("#","").match(/^([0-9a-f]{6})$/i);
  if (!m) return "255,255,255";
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `${r},${g},${b}`;
}
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)] || "#fff";

/* ---------- particle (sparkles) ---------- */
class Particle {
  constructor(x, y, color, size, vx, vy, life) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life;
    this.size = size;
    this.color = color; // hex
  }
  step(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vy += 0.05 * dt * 60;     // gravity
    this.vx *= 0.995; this.vy *= 0.995;
    this.life -= 0.02 * dt * 60;   // fade
    return this.life > 0;
  }
}

/* ---------- beat rings ---------- */
class Ring {
  constructor(x, y, color, maxR, width, lifeScale) {
    this.x = x; this.y = y;
    this.r = 0;
    this.maxR = maxR;
    this.width = width;
    this.life = 1.0;
    this.color = color; // hex
    this.lifeScale = lifeScale;
  }
  step(dt) {
    this.r += (this.maxR * 0.9) * dt * 2.2;
    this.life -= 0.015 * dt * 60 * this.lifeScale;
    return this.life > 0 && this.r < this.maxR;
  }
}

/* ---------- component ---------- */
/**
 * props:
 *  - url: JSON 경로 (예: `${API}/viz-data/<uuid>.json`)
 *  - apiBase: "/uploads" 상대경로 앞에 붙일 서버 주소 (예: "http://localhost:4000")
 *  - sensitivity: RMS 반응(0.7~1.5)
 *  - speed: 애니메이션 속도(0.8~1.3)
 *  - theme: "pastel" | "neon" | "sunset" (palette 미존재시 fallback)
 *  - sparkleGain: 스파클 양/세기(0.5~2.0)
 *  - glow: 발광 강도(0~1.5)
 *  - maxParticles: 파티클 상한(기본 800)
 *  - ringGain: 비트-링 강도/개수(0.6~2.0)
 *  - ringWidth: 링 선 굵기(px)
 *  - ringLife: 링 수명 스케일(0.6~1.5)
 */
export default function JsonViz({
  url,
  apiBase = "http://localhost:4000",
  sensitivity = 1.0,
  speed = 1.0,
  theme = "pastel",
  sparkleGain = 1.2,
  glow = 1.0,
  maxParticles = 800,
  ringGain = 1.0,
  ringWidth = 3,
  ringLife = 1.0
}) {
  const [j, setJ] = useState(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);

  // JSON 로드
  useEffect(() => {
    let alive = true;
    setJ(null);
    fetch(url).then(r => r.json()).then(d => alive && setJ(d)).catch(console.error);
    return () => { alive = false; };
  }, [url]);

  // JSON → 메타 변환 (make_viz.py 스키마 호환)
  const meta = useMemo(() => {
    if (!j) return null;
    const duration = Number(j.duration || 0);
    const beats = (j.beats || []).map(Number);
    const sections = normalizeSections(j.sections || [], duration);
    const palette = toPalette(j.palette, theme);
    const pointColor = j.point_color || palette[0] || "#fff";
    const rmsPairs = toPairs(j.rms || []); // make_viz.py가 {t,v} 쌍으로 저장함
    const pitchPairs = Array.isArray(j.pitch) && j.pitch.length
      ? j.pitch.map(p => ({ t: Number(p.t), v: Number(p.hz || 0) })).sort((a,b)=>a.t-b.t)
      : [];
    // 업로드 오디오(상대경로면 apiBase 붙임)
    const audioUrl = j.audio_url ? (j.audio_url.startsWith("http") ? j.audio_url : `${apiBase}${j.audio_url}`) : null;
    return { duration, beats, sections, palette, pointColor, rmsPairs, pitchPairs, audioUrl };
  }, [j, theme, apiBase]);

  // 오디오 세팅
  useEffect(() => {
    if (!meta?.audioUrl) return;
    const el = audioRef.current;
    if (!el) return;
    el.src = meta.audioUrl;
    el.load();
  }, [meta]);

  // 렌더 루프
  useEffect(() => {
    if (!meta) return;
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d");
    let raf = 0;
    let prevTs = 0;
    const DPR = devicePixelRatio || 1;

    function resize() {
      const w = cvs.clientWidth || 800;
      const hCSS = 420;
      cvs.width = w * DPR;
      cvs.height = hCSS * DPR;
      cvs.style.height = `${hCSS}px`;
    }
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const { duration, beats, sections, palette, pointColor, rmsPairs, pitchPairs } = meta;

    const sectionColor = (t) => {
      if (!sections.length) return palette[0] || "#111";
      const s = sections.find(sec => t >= sec.start && t < sec.end) || sections[sections.length-1];
      const idx = sections.indexOf(s) % palette.length;
      return palette[idx] || "#111";
    };

    const particles = [];
    const rings = [];
    let beatIdx = 0;

    const spawnBurst = (tSec) => {
      const W = cvs.width, H = cvs.height;
      const baseX = (tSec / Math.max(1, duration)) * W;
      const baseY = H * 0.62;
      const count = Math.round(20 * sparkleGain);
      for (let i = 0; i < count; i++) {
        const col = pick(palette);
        const size = rand(2.2, 4.6) * DPR;
        const vx = rand(-2.8, 2.8);
        const vy = rand(-4.0, -1.2);
        const life = rand(0.9, 1.3);
        particles.push(new Particle(baseX, baseY, col, size, vx, vy, life));
      }
      // 박자-링
      const maxR = Math.min(W, H) * (0.45 + 0.25 * Math.random()) * (0.9 + 0.2 * ringGain);
      const ringCount = Math.max(1, Math.round(1 * ringGain));
      for (let i = 0; i < ringCount; i++) {
        const col = pick(palette);
        rings.push(new Ring(baseX, baseY, col, maxR, ringWidth * DPR, ringLife));
      }
    };

    const spawnAmbient = (tSec, rmsVal) => {
      const W = cvs.width, H = cvs.height;
      const amount = Math.min(6, Math.floor(rmsVal * 10 * sparkleGain));
      for (let i = 0; i < amount; i++) {
        const col = pick(palette);
        const x = rand(0, W);
        const y = rand(H*0.45, H*0.85);
        const size = rand(1.6, 3.2) * DPR;
        const vx = rand(-1.2, 1.2);
        const vy = rand(-2.0, -0.4);
        const life = rand(0.6, 1.0);
        particles.push(new Particle(x, y, col, size, vx, vy, life));
      }
    };

    function draw(ts) {
      const el = audioRef.current;
      const tSec = el && !isNaN(el.currentTime) ? el.currentTime : 0;
      const W = cvs.width, H = cvs.height;

      // 배경
      ctx.globalCompositeOperation = "source-over";
      const bg = sectionColor(tSec);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // 라디얼 + 막대
      const rmsVal = clamp(samplePairs(rmsPairs, tSec) * sensitivity, 0, 1);
      const centerX = W * 0.5, centerY = H * 0.52;
      const ringR = Math.min(W, H) * 0.22;
      const spokes = 42;
      ctx.save();
      ctx.translate(centerX, centerY);
      for (let i = 0; i < spokes; i++) {
        const ang = (i / spokes) * Math.PI * 2;
        const amp = ringR * (0.35 + 0.55 * rmsVal);
        const x = Math.cos(ang) * (ringR + amp);
        const y = Math.sin(ang) * (ringR + amp);
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * (ringR * 0.7), Math.sin(ang) * (ringR * 0.7));
        ctx.lineTo(x, y);
        ctx.lineWidth = 1.5 * DPR;
        ctx.strokeStyle = `rgba(255,255,255,0.6)`;
        ctx.stroke();
      }
      ctx.restore();

      // pitch 라인
      if (pitchPairs.length && duration) {
        ctx.beginPath();
        let started = false;
        const N = 200;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const t = u * duration;
          const hz = samplePairs(pitchPairs, t);
          const nh = clamp(hz / 1000, 0, 1);
          const x = u * W;
          const y = H * (0.75 - nh * 0.4);
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.lineWidth = 2 * DPR;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.stroke();
      }

      // 수평 막대
      const bars = 28;
      const bw = W / bars;
      for (let i = 0; i < bars; i++) {
        const n = Math.sin((tSec * 2.0 + i) * 0.7 * speed) * 0.5 + 0.5;
        const h = Math.min(H * 0.6, 10 + (H * 0.6 - 10) * clamp(rmsVal * (0.6 + 0.7 * n), 0, 1));
        const x = i * bw + bw * 0.15;
        const y = H - h - 18 * DPR;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(x, y, bw * 0.7, h);
      }

      // 비트 이벤트 처리
      while (beatIdx < beats.length && beats[beatIdx] <= tSec) {
        spawnBurst(beats[beatIdx]);
        beatIdx++;
      }
      spawnAmbient(tSec, rmsVal);

      // 스파클 & 링 그리기
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 24 * glow * DPR;
      ctx.shadowColor = "rgba(255,255,255,0.85)";

      const dt = prevTs ? Math.min(0.06, (ts - prevTs)/1000) : 0.016;
      prevTs = ts;

      // particles
      if (particles.length > maxParticles) particles.splice(0, particles.length - maxParticles);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (!p.step(dt)) { particles.splice(i, 1); continue; }
        const a = clamp(p.life, 0, 1);
        const fill = `rgba(${hexToRgb(p.color)},${0.35 + 0.65*a})`;
        ctx.beginPath();
        ctx.fillStyle = fill;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        if (!r.step(dt)) { rings.splice(i, 1); continue; }
        const alpha = clamp(r.life, 0, 1) * (0.55 + 0.35 * glow);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${hexToRgb(r.color)},${alpha})`;
        ctx.lineWidth = r.width;
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 복원
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [meta, sensitivity, speed, theme, sparkleGain, glow, maxParticles, ringGain, ringWidth, ringLife]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ marginBottom: 8, color: "#666" }}>
        애니메이션 + 오디오 동기 재생 (스파클 & 빛 고리)
      </div>
      {meta?.audioUrl && (
        <audio ref={audioRef} src={meta.audioUrl} controls style={{ width: "100%", marginBottom: 8 }} />
      )}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: 420, borderRadius: 12, background: "#111" }}
      />
    </div>
  );
}
