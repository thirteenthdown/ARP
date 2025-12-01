const { io } = require('socket.io-client');

// paste your token here for testing
const TOKEN = process.env.TOKEN || "YOUR_JWT_HERE";

const socket = io("http://localhost:3000", {
  auth: {
    token: TOKEN
  }
});

socket.on("connect_error", (err) => {
  console.log("CONNECT ERROR:", err.message);
});

socket.on("connect", () => {
  console.log("socket connected", socket.id);

  // tell server where you are
  socket.emit("set_location", { lat: 18.5204, lng: 73.8567 });
});
