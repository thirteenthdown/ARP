import React, { useState, useEffect } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import { connectSocket } from "./lib/socket";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    if (loggedIn) {
      connectSocket();
    }
  }, [loggedIn]);

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <Home
      onLogout={() => {
        localStorage.removeItem("token");
        setLoggedIn(false);
      }}
    />
  );
}
