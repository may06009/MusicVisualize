import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

export default function App() {
  const loc = useLocation();
  const navigate = useNavigate();

  const onHome = loc.pathname === "/";
  const authed = !!localStorage.getItem("token"); // 토큰 있으면 로그인 상태

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/auth", { replace: true });
  };

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "24px auto",
        padding: "0 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>🎵 Music → Visualize</h1>
        </Link>

        {/* 비로그인 상태에서는 아무 버튼도 안 보임. 로그인 상태에서만 로그아웃 버튼 */}
        <nav style={{ display: "flex", gap: 8 }}>
          {!onHome && (
            <Link
              to="/"
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "white",
              }}
            >
              메인
            </Link>
          )}
          {authed && (
            <button
              onClick={logout}
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "white",
                cursor: "pointer",
              }}
            >
              로그아웃
            </button>
          )}
        </nav>
      </header>

      <Outlet />
    </div>
  );
}
