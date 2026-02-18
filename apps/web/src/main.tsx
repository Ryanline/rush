import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Queue from "./pages/Queue";
import Preview from "./pages/Preview";
import Chat from "./pages/Chat";
import PostChat from "./pages/PostChat";


function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/post-chat" element={<PostChat />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);