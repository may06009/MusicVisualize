import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:4000";

export default function Home() {
  // 보호: 토큰 없으면 /auth로 이동
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  useEffect(() => {
    if (!token) navigate("/auth", { replace: true });
  }, [token, navigate]);

  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const onUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append("audio_file", file);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API}/visualize`, { method: "POST", headers, body: form });
    const json = await res.json();
    setJobId(json.job_id);
    setData(null);
  };

  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      const r = await fetch(`${API}/jobs/${jobId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((x) => x.json());
      setData(r);
      if (["done", "failed", "timeout"].includes(r.status)) {
        clearInterval(t);
        setLoading(false);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [jobId, token]);

  return (
    <div>
      <h2 style={{ fontSize: 26, marginBottom: 8 }}>메인 페이지 (업로드 & 시각화)</h2>
      <p style={{ color: "#555", marginBottom: 24 }}>
        음악 파일 업로드 → 서버가 결과 <b>URL</b>을 반환 → 이미지를 표시합니다.
      </p>

      <form onSubmit={onUpload} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <input type="file" accept=".wav,.mp3,.m4a" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button
          type="submit"
          disabled={!file || loading}
          style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #ddd", background: loading ? "#eee" : "white", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "처리 중..." : "업로드"}
        </button>
      </form>

      {jobId && (
        <div style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          Job ID: <code>{jobId}</code>
        </div>
      )}

      {data?.status === "running" && (
        <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 12, background: "#fafafa" }}>
          처리 중입니다… {Math.floor(Math.random() * 30) + 60}%
        </div>
      )}

      {data?.status === "done" && data?.result?.type === "image" && (
        <div style={{ marginTop: 12 }}>
          <img
            src={`${API}${data.result.url}`}
            alt="result"
            style={{ width: "100%", height: "auto", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
          />
        </div>
      )}

      {data?.status === "failed" && <div style={{ color: "crimson" }}>실패: {data?.error?.message || "알 수 없는 오류"}</div>}
    </div>
  );
}
