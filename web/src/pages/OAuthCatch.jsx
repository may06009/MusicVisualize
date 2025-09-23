import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function OAuthCatch() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = sp.get("token");
    if (token) {
      localStorage.setItem("token", token);
      navigate("/", { replace: true });
    } else {
      navigate("/auth?error=missing_token", { replace: true });
    }
  }, [sp, navigate]);

  return <div style={{ padding: 24 }}>소셜 로그인 처리 중…</div>;
}
