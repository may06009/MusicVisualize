import { useEffect, useRef, useState } from "react";

function toPairs(arrOrPairs = []) {
  // [{t,v}] 또는 number[] 모두 허용 → [{t,v}]로 통일
  if (!arrOrPairs || !arrOrPairs.length) return [];
  if (typeof arrOrPairs[0] === "number") {
    const N = arrOrPairs.length;
    return arrOrPairs.map((v, i) => ({ t: i / Math.max(1, N - 1), v })); // 0~1 정규시간
  }
  return arrOrPairs.map(p => ({ t: Number(p.t), v: Number(p.v) })).sort((a,b)=>a.t-b.t);
}

function rmsAt(pairs, t) {
  if (!pairs.length) return 0;
  if (t <= pairs[0].t) return pairs[0].v;
  if (t >= pairs[pairs.length - 1].t) return pairs[pairs.length - 1].v;
  // 이진 탐색 or 선형 탐색
  let i = 1;
  while (i < pairs.length && pairs[i].t < t) i++;
  const p0 = pairs[i - 1], p1 = pairs[i];
  const u = (t - p0.t) / Math.max(1e-6, (p1.t - p0.t));
  return p0.v + (p1.v - p0.v) * u;
}

function toPalette(pal) {
  if (!pal) return ["#111", "#333", "#666", "#999"];
  if (Array.isArray(pal)) return pal;
  // dict → 배열 (키 정렬)
  const keys = Object.keys(pal).sort((a, b) => Number(a) - Number(b));
  return keys.map(k => pal[k]);
}

function normalizeSections(sections = [], duration = 0) {
  if (!sections.length) return [];
  if ("start" in sections[0]) return sections; // {start,end,label}
  // [{end}] → {start,end}
  const out = [];
  let prev = 0;
  for (let i = 0; i < sections.length; i++) {
    const end = Number(sections[i].end);
    out.push({ start: prev, end, label: String.fromCharCode(65 + i) });
    prev = end;
  }
  if (out[out.length - 1].end < duration) {
    out[out.length - 1].end = duration;
  }
  return out;
}

export default function JsonViz({ url }) {
  const [j, setJ] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    setJ(null);
    fetch(url).then(r => r.json()).then(setJ).catch(console.error);
  }, [url]);

  useEffect(() => {
    if (!j) return;
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d");

    const DPR = devicePixelRatio || 1;
    const W = (cvs.width = cvs.clientWidth * DPR);
    const H = (cvs.height = 360 * DPR);

    const duration = Number(j.duration || 0);
    const beats = (j.beats || []).map(Number);
    const sections = normalizeSections(j.sections || [], duration);
    const palette = toPalette(j.palette);
    const pointColor = j.point_color || palette[0] || "#fff";

    const rmsPairs = toPairs(j.rms || []);
    const fps = 60;
    const bars = 24;

    let raf = 0;

    function sectionColor(t) {
      if (!sections.length) return palette[0] || "#111";
      const s = sections.find(sec => t >= sec.start && t < sec.end) || sections[sections.length - 1];
      const idx = sections.indexOf(s) % palette.length;
      return palette[idx] || "#111";
    }

    function draw(ts) {
      const frame = Math.floor((ts / 1000) * fps);
      const tSec = duration ? (frame / fps) % duration : 0;

      // 배경
      ctx.fillStyle = sectionColor(tSec);
      ctx.fillRect(0, 0, W, H);

      // 막대
      const base = rmsAt(rmsPairs, tSec);
      const w = W / bars;
      for (let i = 0; i < bars; i++) {
        const n = Math.sin((frame * 0.12 + i) * 0.5) * 0.5 + 0.5;
        const h = Math.min(H * 0.85, 8 + (H * 0.85 - 8) * Math.min(1, base * 1.2 * (0.7 + 0.6 * n)));
        const x = i * w + w * 0.15;
        const y = H - h;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(x, y, w * 0.7, h);
      }

      // 비트 인디케이터
      if (beats.length && duration) {
        const x = (tSec / duration) * W;
        ctx.beginPath();
        ctx.fillStyle = pointColor;
        ctx.arc(x, H - 6, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [j]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ marginBottom: 8, color: "#666" }}>애니메이션(실시간 렌더, JSON 기반)</div>
      <canvas ref={canvasRef} style={{ width: "100%", height: 360, borderRadius: 12, background: "#111" }} />
    </div>
  );
}
