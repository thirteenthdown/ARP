// src/lib/otp.js
const otpStore = new Map(); // phone -> { otp, expiresAt }

function genOtp() {
  return Math.floor(100000 + Math.random()*900000).toString(); // 6-digit
}

function sendOtpToPhone(phone) {
  const otp = genOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  otpStore.set(phone, { otp, expiresAt });
  console.log(`[DEV OTP] phone=${phone} code=${otp}`);
  return otp;
}

function validateOtp(phone, code) {
  const item = otpStore.get(phone);
  if (!item) return false;
  if (Date.now() > item.expiresAt) { otpStore.delete(phone); return false; }
  if (item.otp !== code) return false;
  otpStore.delete(phone);
  return true;
}

module.exports = { otpStore, sendOtpToPhone, validateOtp };
