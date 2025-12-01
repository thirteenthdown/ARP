import React from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import { connectSocket } from "./lib/socket";

export default function App() {
  const [loggedIn, setLoggedIn] = React.useState(
    !!localStorage.getItem("token")
  );

  React.useEffect(() => {
    if (loggedIn) {
      connectSocket();
    }
  }, [loggedIn]);

  
  if (!loggedIn) {
  return <Login onLogin={() => setLoggedIn(true)} />;
  }

  return <Home />;

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <h1 className="text-3xl font-semibold">Welcome to Animal Rescue</h1>
      <p className="text-gray-600 mt-2">You are logged in.</p>
      <p className="text-green-600 mt-4 font-medium">Socket connected.</p>
    </div>
  );
}
