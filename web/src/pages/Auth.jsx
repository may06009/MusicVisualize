import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:4000";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // or "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 이미 로그인 상태면 메인으로
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) navigate("/", { replace: true });
  }, [navigate]);

  const submitAuth = async (e) => {
    e.preventDefault();
    const url = mode === "login" ? "/auth/login" : "/auth/register";
    const res = await fetch(`${API}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || "인증 오류");
    localStorage.setItem("token", json.token);
    navigate("/", { replace: true });
  };

  return (
    <div>
      <h2 style={{ fontSize: 26, marginBottom: 8 }}>로그인 / 회원가입</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode("login")}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: mode === "login" ? "#f2f2f2" : "white" }}
        >
          로그인
        </button>
        <button
          onClick={() => setMode("register")}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: mode === "register" ? "#f2f2f2" : "white" }}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={submitAuth} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
            required
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd" }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          required
          minLength={6}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button type="submit" style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #ddd", background: "white" }}>
          {mode === "login" ? "로그인" : "회원가입"}
        </button>
      </form>

      {/* 소셜 로그인 */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <a
          href={`${API}/oauth/google`}
          style={{ padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none", background: "white" }}
        >
          Google로 계속하기
        </a>
        <a
          href={`${API}/oauth/naver`}
          style={{ padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none", background: "white" }}
        >
          네이버로 계속하기
        </a>
      </div>
    </div>
  );
}
