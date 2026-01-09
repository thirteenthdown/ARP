// src/App.jsx
import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Home from "./pages/Home";
import Blogs from "./pages/Blogs";
import MyProfile from "./pages/MyProfile"; // <--- IMPORT THE REAL FILE HERE

export default function App() {
  // read once from localStorage to initialise state
  const [token, setToken] = useState(localStorage.getItem("token") || null);

  // helper to set token in state + localStorage
  const handleSetToken = (t) => {
    if (t) {
      localStorage.setItem("token", t);
      setToken(t);
    } else {
      localStorage.removeItem("token");
      setToken(null);
    }
  };

  const handleLogout = () => {
    handleSetToken(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* public */}
        <Route
          path="/login"
          element={<Login onLogin={handleSetToken} />}
        />
        <Route
          path="/register"
          element={<Register onRegistered={handleSetToken} />}
        />
        <Route
          path="/verify-email"
          element={<VerifyEmail onVerified={handleSetToken} />}
        />

        {/* protected */}
        <Route
          path="/"
          element={token ? <Home onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        
        {/* New Pages */}
        <Route 
          path="/blogs" 
          element={token ? <Blogs onLogout={handleLogout} /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/profile" 
          // Pass onLogout to MyProfile so the Logout button works there too
          element={token ? <MyProfile onLogout={handleLogout} /> : <Navigate to="/login" replace />} 
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}