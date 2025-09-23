import { useEffect, useRef, useState, useMemo } from "react";

// --- 유틸 ---
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
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
  if ("start" in sections[0]) return sections;
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

export default function JsonViz({ url, apiBase = "http://localhost:4000", sensitivity = 1.0, speed = 1.0, theme = "pastel" }) {
  const [j, setJ] = useState(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setJ(null);
    fetch(url).then(r => r.json()).then(d => alive && setJ(d)).catch(console.error);
    return () => { alive = false; };
  }, [url]);

  const meta = useMemo(() => {
    if (!j) return null;
    const duration = Number(j.duration || 0);
    const beats = (j.beats || []).map(Number);
    const sections = normalizeSections(j.sections || [], duration);
    const palette = toPalette(j.palette, theme);
    const pointColor = j.point_color || palette[0] || "#fff";
    const rmsPairs = toPairs(j.rms || []);
    const pitchPairs = Array.isArray(j.pitch) && j.pitch.length
      ? j.pitch.map(p => ({ t: Number(p.t), v: Number(p.hz || 0) })).sort((a,b)=>a.t-b.t)
      : [];
    // 오디오 URL (JSON에 상대경로가 오면 apiBase 붙임)
    const audioUrl = j.audio_url ? (j.audio_url.startsWith("http") ? j.audio_url : `${apiBase}${j.audio_url}`) : null;
    return { duration, beats, sections, palette, pointColor, rmsPairs, pitchPairs, audioUrl };
  }, [j, theme, apiBase]);

  // 오디오 엘리먼트 준비
  useEffect(() => {
    if (!meta) return;
    if (!meta.audioUrl) return;
    const el = audioRef.current;
    if (!el) return;
    el.src = meta.audioUrl;
    el.load();
  }, [meta]);

  useEffect(() => {
    if (!meta) return;
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d");
    let raf = 0;
    const DPR = devicePixelRatio || 1;

    // 크기
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

    const { duration, beats, sections, palette, pointColor, rmsPairs, pitchPairs, audioUrl } = meta;
    const bars = 28;

    const sectionColor = (t) => {
      if (!sections.length) return palette[0] || "#111";
      const s = sections.find(sec => t >= sec.start && t < sec.end) || sections[sections.length-1];
      const idx = sections.indexOf(s) % palette.length;
      return palette[idx] || "#111";
    };

    function draw() {
      // ⛳️ 오디오와 동기화: 재생 중이면 currentTime, 아니면 시간 진행
      const el = audioRef.current;
      const tSec = el && !isNaN(el.currentTime) ? el.currentTime : 0;

      const W = cvs.width, H = cvs.height;
      // 배경
      ctx.fillStyle = sectionColor(tSec);
      ctx.fillRect(0, 0, W, H);

      // 라디얼 + 막대 (간략화)
      const rmsVal = clamp(samplePairs(rmsPairs, tSec), 0, 1) * sensitivity;
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
      const w = W / bars;
      for (let i = 0; i < bars; i++) {
        const n = Math.sin((tSec * 2.0 + i) * 0.7 * speed) * 0.5 + 0.5;
        const h = Math.min(H * 0.6, 10 + (H * 0.6 - 10) * clamp(rmsVal * (0.6 + 0.7 * n), 0, 1));
        const x = i * w + w * 0.15;
        const y = H - h - 18 * DPR;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(x, y, w * 0.7, h);
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [meta, sensitivity, speed]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ marginBottom: 8, color: "#666" }}>애니메이션 + 오디오 동기 재생</div>

      {/* ✅ 오디오 컨트롤 (JSON에 audio_url 있을 때만 표시) */}
      {meta?.audioUrl && (
        <audio
          ref={audioRef}
          src={meta.audioUrl}
          controls
          style={{ width: "100%", marginBottom: 8 }}
        />
      )}

      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: 420, borderRadius: 12, background: "#111" }}
      />
    </div>
  );
}
