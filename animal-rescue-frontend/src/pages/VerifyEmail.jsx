// src/pages/VerifyEmail.jsx
import React, { useState } from "react";
import api from "../lib/api";
import { useNavigate, useLocation } from "react-router-dom";

export default function VerifyEmail({ onVerified }) {
  const navigate = useNavigate();
  const location = useLocation();

  // autofill from register
  const initialEmail = location?.state?.email || "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (!email || !otp) {
      alert("Enter email & OTP");
      return;
    }

    try {
      setLoading(true);
      // Backend expects { email, code } for /auth/verify-otp now
      const res = await api.post("/auth/verify-otp", { email, code: otp });

      const t = res.data?.token;
      if (t) {
        if (typeof onVerified === "function") onVerified(t);
        else localStorage.setItem("token", t);
        alert("Email verified! Welcome.");
        navigate("/");
      } else {
        alert("No token returned from server.");
      }
    } catch (err) {
      console.error("verify-otp error:", err);
      alert(err?.response?.data?.error || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '20px', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '20px' }}>Verify Email Address</h2>
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>
          We have sent a verification code to your email. Please enter it below.
        </p>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #ddd', marginBottom: '10px', boxSizing:'border-box' }}
        />

        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter OTP Code"
          style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #ddd', marginBottom: '10px', boxSizing:'border-box' }}
        />

        <button
          onClick={handleVerify}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#222', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}
        >
          {loading ? "VERIFYING..." : "VERIFY EMAIL"}
        </button>
      </div>
    </div>
  );
}
