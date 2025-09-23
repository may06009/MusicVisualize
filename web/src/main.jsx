import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,            // 공통 레이아웃(헤더/풋터 등)
    children: [
      { index: true, element: <Home /> }, // 메인 = 업로드/시각화
      { path: "auth", element: <Auth /> } // 로그인/회원가입
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
