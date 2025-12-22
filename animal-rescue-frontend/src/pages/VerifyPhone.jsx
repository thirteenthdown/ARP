// src/pages/VerifyPhone.jsx
import React, { useState } from "react";
import api from "../lib/api";
import { useNavigate, useLocation } from "react-router-dom";

export default function VerifyPhone({ onVerified }) {
  const navigate = useNavigate();
  const location = useLocation();

  // autofill from register
  const initialPhone = location?.state?.phone || "";

  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (!phone || !otp) {
      alert("Enter phone & OTP");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/auth/verify-otp", { phone, code: otp });

      const t = res.data?.token;
      if (t) {
        if (typeof onVerified === "function") onVerified(t);
        else localStorage.setItem("token", t);
        alert("Phone verified!");
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
    <div className="max-w-md mx-auto p-4 mt-10 bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-4">Verify Phone Number</h2>

      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (+91...)"
        className="w-full p-2 border rounded mb-3"
      />

      <input
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="Enter OTP"
        className="w-full p-2 border rounded mb-3"
      />

      <button
        onClick={handleVerify}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        {loading ? "Verifying..." : "Verify OTP"}
      </button>
    </div>
  );
}
