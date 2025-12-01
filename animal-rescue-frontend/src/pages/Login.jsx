import React, { useState } from "react";
import api from "../lib/api";
import { connectSocket } from "../lib/socket";

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // phone → otp
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function requestOtp() {
    try {
      setLoading(true);
      await api.post("/auth/request-otp", { phone });
      setStep("otp");
      setMessage("OTP sent (check backend console in DEV).");
    } catch (err) {
      setMessage("Error sending OTP");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    try {
      setLoading(true);
      const res = await api.post("/auth/verify-otp", {
        phone,
        code: otp,
        username: "user_" + Math.floor(Math.random() * 9999)
      });

      const token = res.data.token;

      localStorage.setItem("token", token);

      // connect socket after login
      connectSocket();

      if (onLogin) onLogin();

    } catch (err) {
      setMessage("Invalid OTP");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white p-8 shadow-md rounded w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4 text-center">Login</h1>

        {step === "phone" && (
          <>
            <label className="block mb-2 text-sm font-medium">Phone Number</label>
            <input
              type="text"
              className="w-full p-2 border rounded mb-4"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+917000000000"
            />

            <button
              onClick={requestOtp}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              {loading ? "Sending..." : "Request OTP"}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <label className="block mb-2 text-sm font-medium">Enter OTP</label>
            <input
              type="text"
              className="w-full p-2 border rounded mb-4"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
            />

            <button
              onClick={verifyOtp}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </>
        )}

        {message && (
          <p className="mt-4 text-center text-sm text-gray-600">{message}</p>
        )}
      </div>
    </div>
  );
}
