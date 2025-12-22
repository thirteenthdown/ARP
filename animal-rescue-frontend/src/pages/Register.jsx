// src/pages/Register.jsx
import React, { useState } from "react";
import api from "../lib/api";
import { useNavigate, Link } from "react-router-dom";

const AVATARS = [
  "/avatars/dog-1.png",
  "/avatars/cat-1.png",
  "/avatars/rabbit-1.png",
  "/avatars/parrot-1.png",
];

export default function Register({ onRegistered }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [favourite, setFavourite] = useState("");
  const [reason, setReason] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        username,
        password,
        phone,
        email,
        full_name: fullName,
        gender,
        age,
        favourite_animal: favourite,
        reason,
        avatar,
      });

      if (res.data && res.data.token) {
        const t = res.data.token;
        if (typeof onRegistered === "function") {
          onRegistered(t);
        } else {
          localStorage.setItem("token", t);
        }
      }

      navigate("/verify-phone", { state: { phone } });
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register-wrapper">
      {/* Embedded CSS Styles */}
      <style>{`
        .register-wrapper {
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
        .register-container {
            width: 100%;
            max-width: 600px;
            text-align: left;
            padding: 20px;
            box-sizing: border-box;
        }
        /* Header */
        .reg-header h1 {
            font-family: sans-serif;
            font-weight: 500;
            font-size: 18px;
            letter-spacing: 0.5px;
            margin: 0 0 15px 0;
            color: #222;
        }
        .reg-header .chinese {
            font-family: 'Times New Roman', Times, serif;
            font-weight: 500;
            color: #333;
            margin-left: 5px;
        }
        .reg-header .section-mark {
            font-size: 60%;
            float: right;
            position: relative;
            top: 7px;
            margin-left: 10px;
        }
        .description {
            font-size: 12px;
            margin: 10px 0;
            line-height: 1.37;
            font-weight: 600;
            color: #5f5e5e;
        }
        /* Dividers & Layout */
        .thin-line {
            border: none;
            border-top: 1px solid #ddd;
            margin: 20px 0;
        }
        .sections-row {
            display: flex;
            justify-content: space-between;
            position: relative;
            flex-wrap: wrap;
            gap: 20px;
        }
        .form-column {
            width: 48%;
            min-width: 250px;
        }
        .section-title {
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 15px;
            color: #333;
            text-transform: uppercase;
            display: block;
        }
        .section-num {
            font-size: 90%;
            float: right;
        }
        /* Inputs */
        .input-group {
            margin-bottom: 12px;
        }
        .styled-input, .styled-textarea {
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
        .styled-textarea {
            resize: none;
        }
        .styled-input:focus, .styled-textarea:focus {
            border-color: #333;
        }
        .row-inputs {
            display: flex;
            gap: 10px;
        }
        /* Avatars */
        .avatar-grid {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .avatar-btn {
            border: 1px solid #ddd;
            background: transparent;
            padding: 5px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .avatar-btn:hover {
            border-color: #999;
        }
        .avatar-btn.selected {
            border-color: #222;
            background-color: #f5f5f5;
        }
        .avatar-img {
            width: 40px;
            height: 40px;
            object-fit: cover;
            display: block;
        }
        /* Buttons */
        .action-btn {
            background-color: transparent;
            border: 1px solid #ddd;
            color: #4a4a4a;
            padding: 12px 20px;
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
        /* Footer */
        .reg-footer {
            margin-top: 30px;
            font-size: 14px;
            letter-spacing: 0.1em;
            font-weight: bolder;
            color: #9f9d9d;
            font-family: 'Courier New', Courier, monospace;
            text-align: right;
        }
        .reg-footer a {
            color: inherit;
            text-decoration: none;
        }
        .reg-footer a:hover {
            color: #333;
        }
      `}</style>

      <div className="register-container">
        <header className="reg-header">
          <h1>
            Create Account <span className="chinese">[注 册]</span>
            <span className="section-mark" style={{ fontSize: "70%", position: "relative", top: "7px" }}>[1]</span>
          </h1>
          <p className="description">
            Join the network. Please fill out the details below to establish your digital identity.
            Private details are encrypted [安 全].
          </p>
          <hr className="thin-line" />
        </header>

        <form onSubmit={submit}>
          <div className="sections-row">
            
            {/* LEFT COLUMN: Personal & Private */}
            <div className="form-column">
              <span className="section-title">
                [ PERSONAL ] <span className="section-num">[2]</span>
              </span>
              
              <div className="input-group">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name (Private)"
                  className="styled-input"
                />
              </div>

              <div className="input-group row-inputs">
                <input
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="Gender"
                  className="styled-input"
                  style={{ flex: 1 }}
                />
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Age"
                  className="styled-input"
                  style={{ width: "60px" }}
                />
              </div>

              <div className="input-group">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone Number (Private)"
                  className="styled-input"
                />
              </div>
              
              <div className="input-group">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address (Private)"
                  className="styled-input"
                />
              </div>
              
              <div className="input-group">
                <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set Password"
                    type="password"
                    className="styled-input"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: Public Profile */}
            <div className="form-column">
              <span className="section-title">
                [ PROFILE ] <span className="section-num">[3]</span>
              </span>
              
              <div className="input-group">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (Public)"
                  className="styled-input"
                />
              </div>

              <div className="input-group">
                <input
                  value={favourite}
                  onChange={(e) => setFavourite(e.target.value)}
                  placeholder="Favourite Animal"
                  className="styled-input"
                />
              </div>

              <div className="input-group">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you joining us?"
                  className="styled-textarea"
                  rows={3}
                />
              </div>

              <div className="input-group">
                <span className="section-title" style={{ fontSize: '10px', marginBottom: '10px' }}>[ SELECT AVATAR ]</span>
                <div className="avatar-grid">
                  {AVATARS.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => setAvatar(a)}
                      className={`avatar-btn ${avatar === a ? "selected" : ""}`}
                    >
                      <img src={a} alt="Avatar" className="avatar-img" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <hr className="thin-line" />

          <button type="submit" className="action-btn" disabled={loading}>
            {loading ? "PROCESSING REQUEST..." : "COMPLETE REGISTRATION"}
          </button>
        </form>

        <footer className="reg-footer">
          <p>
            <Link to="/login">Already have an ID? Login.</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}