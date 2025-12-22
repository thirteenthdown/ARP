// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { connectSocket } from "../lib/socket";

export default function Login({ onLogin }) {
  const navigate = useNavigate();

  const [mode, setMode] = useState("password"); // "password" or "otp"
  const [identifier, setIdentifier] = useState(""); // username / phone / email
  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState(""); // phone for OTP
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  async function submitPassword(e) {
    e.preventDefault();
    if (!identifier || !password) {
      alert("Please enter username (or phone/email) and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", {
        usernameOrPhoneOrEmail: identifier,
        password,
      });

      if (res.data && res.data.token) {
        const t = res.data.token;
        if (typeof onLogin === "function") {
          onLogin(t);
        } else {
          localStorage.setItem("token", t);
        }
        try { connectSocket(); } catch (e) { /* ignore */ }
        navigate("/");
      } else {
        alert("Login failed: no token returned.");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp() {
    if (!phone) {
      alert("Please enter a phone number (e.g. +91...)");
      return;
    }
    setOtpLoading(true);
    try {
      await api.post("/auth/request-otp", { phone });
      alert("OTP requested — check server console or SMS.");
    } catch (err) {
      console.error("request-otp error:", err);
      alert(err?.response?.data?.error || "OTP request failed");
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtp() {
    if (!phone || !otp) {
      alert("Please provide phone and OTP.");
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", { phone, code: otp });

      if (res.data && res.data.token) {
        const t = res.data.token;
        if (typeof onLogin === "function") {
          onLogin(t);
        } else {
          localStorage.setItem("token", t);
        }
        try { connectSocket(); } catch (e) {}
        navigate("/");
      } else {
        if (res.data && res.data.error === "user_not_found") {
          alert("Phone not registered. Please register first.");
          navigate("/register", { state: { phone } });
        } else {
          alert("OTP verify failed.");
        }
      }
    } catch (err) {
      console.error("verify-otp error:", err);
      alert(err?.response?.data?.error || "OTP verification failed");
    } finally {
      setVerifyLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      {/* Embedded CSS Styles */}
      <style>{`
        .login-wrapper {
            font-family: sans-serif;
            font-size: 10px;
            color: #4a4a4a;
            background-color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            line-height: 1;
            width: 100%;
        }
        .login-container {
            width: 100%;
            max-width: 600px;
            text-align: left;
            padding: 20px;
            box-sizing: border-box;
        }
        /* Header */
        .login-header h1 {
            opacity: 1;
            font-family: sans-serif;
            font-weight: 500;
            font-size: 18px;
            letter-spacing: 0.5px;
            margin: 0 0 15px 0;
            color: #222;
        }
        .login-header .chinese {
            font-family: 'Times New Roman', Times, serif;
            font-weight: 500;
            color: #333;
            margin-left: 5px;
        }
        /* UPDATED SECTION MARK STYLE */
        .section-mark {
            font-size: 100%; /* Changed from 60% */
            float: right;
            margin-left: 10px;
            font-weight: normal;
        }
        .login-header .description {
            font-size: 12px;
            margin: 10px 0;
            line-height: 1.37;
            font-weight: 600;
            color: #5f5e5e;
        }
        /* Divider */
        .thin-line {
            border: none;
            border-top: 1px solid #ddd;
            margin: 20px 0;
        }
        /* Section Headers */
        .section-title {
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 15px;
            color: #333;
            text-transform: uppercase;
            display: block;
        }
        /* Form Styling */
        .login-form {
            margin-top: 20px;
        }
        .input-group {
            margin-bottom: 15px;
        }
        .styled-input {
            width: 100%;
            padding: 10px;
            font-size: 12px;
            font-family: sans-serif;
            color: #4a4a4a;
            border: 1px solid #ddd;
            background: transparent;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.3s ease;
        }
        .styled-input:focus {
            border-color: #333;
        }
        /* Toggles */
        .toggle-container {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
        }
        .toggle-btn {
            background: none;
            border: none;
            padding: 0;
            font-size: 12px;
            font-weight: 600;
            color: #999;
            cursor: pointer;
            text-transform: uppercase;
            transition: color 0.3s ease;
        }
        .toggle-btn.active {
            color: #333;
            text-decoration: underline;
        }
        .toggle-btn:hover {
            color: #4a4a4a;
        }
        /* Action Buttons */
        .action-btn {
            background-color: transparent;
            border: 1px solid #ddd;
            color: #4a4a4a;
            padding: 10px 20px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            cursor: pointer;
            width: 100%;
            transition: all 0.3s ease;
            margin-top: 10px;
        }
        .action-btn:hover {
            background-color: #f9f9f9;
            border-color: #999;
            color: #222;
        }
        .action-btn:disabled {
            color: #ccc;
            border-color: #eee;
            cursor: not-allowed;
        }
        .flex-row {
            display: flex;
            gap: 10px;
        }
        .flex-1 {
            flex: 1;
        }
        /* Footer */
        .login-footer {
            margin-top: 40px;
            font-size: 14px;
            letter-spacing: 0.1em;
            font-weight: bolder;
            color: #9f9d9d;
            font-family: 'Courier New', Courier, monospace;
        }
        .login-footer a {
            color: inherit;
            text-decoration: none;
            transition: color 0.3s ease;
        }
        .login-footer a:hover {
            color: #333;
        }
      `}</style>

      <div className="login-container">
        <header className="login-header">
          <h1>
            Authentication <span className="chinese">[登 录]</span>
            <span className="section-mark" style={{ fontSize: "70%", position: "relative", top: "7px" }}>[1]</span>
          </h1>
          <p className="description">
            Please identify yourself to access the platform. Select your preferred method below.
          </p>
          <hr className="thin-line" />
        </header>

        {/* Mode Selection Toggles */}
        <section>
          <div className="toggle-container">
            <button
              onClick={() => setMode("password")}
              className={`toggle-btn ${mode === "password" ? "active" : ""}`}
            >
              [ Password Login ]
            </button>
            <button
              onClick={() => setMode("otp")}
              className={`toggle-btn ${mode === "otp" ? "active" : ""}`}
            >
              [ OTP Login ]
            </button>
          </div>
        </section>

        {/* Password Form */}
        {mode === "password" && (
          <form onSubmit={submitPassword} className="login-form">
            <span className="section-title">
              [ CREDENTIALS ] <span className="section-mark">[2]</span>
            </span>
            <div className="input-group">
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username / Phone / Email"
                className="styled-input"
              />
            </div>
            <div className="input-group">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Password"
                className="styled-input"
              />
            </div>
            <button type="submit" className="action-btn" disabled={loading}>
              {loading ? "AUTHENTICATING..." : "LOGIN"}
            </button>
          </form>
        )}

        {/* OTP Form */}
        {mode === "otp" && (
          <div className="login-form">
            <span className="section-title">
              [ MOBILE VERIFICATION ] <span className="section-mark">[3]</span>
            </span>
            <div className="input-group">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (+91...)"
                className="styled-input"
              />
            </div>

            <div className="input-group flex-row">
              <button
                onClick={requestOtp}
                className="action-btn"
                style={{ width: "auto" }}
                disabled={otpLoading}
              >
                {otpLoading ? "REQ..." : "REQUEST OTP"}
              </button>

              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP"
                className="styled-input flex-1"
              />
            </div>

            <button
              onClick={verifyOtp}
              className="action-btn"
              disabled={verifyLoading}
            >
              {verifyLoading ? "VERIFYING..." : "VERIFY & LOGIN"}
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="login-footer">
          <hr className="thin-line" />
          <p>
            <Link to="/register">Don't have an account? Register.</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}