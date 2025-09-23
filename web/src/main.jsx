import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import OAuthCatch from "./pages/OAuthCatch.jsx";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // 공통 레이아웃
    children: [
      { index: true, element: <Home /> },      // 메인 = 업로드/시각화(보호는 Home 안에서 처리)
      { path: "auth", element: <Auth /> },     // 로그인/회원가입
      { path: "oauth/callback", element: <OAuthCatch /> } // 소셜 로그인 토큰 수신
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
