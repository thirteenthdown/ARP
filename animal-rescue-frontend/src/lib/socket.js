import { io } from "socket.io-client";

let socket = null;

export function connectSocket() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  socket = io(import.meta.env.VITE_API_URL, {
    auth: { token }
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message);
  });

  return socket;
}

export function getSocket() {
  return socket;
}
