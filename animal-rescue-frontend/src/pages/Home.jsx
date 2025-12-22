// src/pages/Home.jsx
import React, { useEffect, useState, useRef } from "react";
import MapView from "../components/MapView";
import api from "../lib/api";
import { getSocket, connectSocket } from "../lib/socket";
import dayjs from "dayjs";

/**
 * Home (Animal Rescue Hub) — Refactored
 * Fixes:
 * 1. Map now strictly receives only OPEN reports to remove clutter.
 * 2. Top Left: ID & Logout.
 * 3. Header Right: [1].
 */

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Helper to return CSS class based on severity
function severityClass(sev) {
  if (sev === 3) return "severity-high";
  if (sev === 2) return "severity-med";
  return "severity-low";
}

function formatDate(iso) {
  return dayjs(iso).format("MMM D, YYYY HH:mm");
}

function getUserIdFromToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return (
      payload.userId || payload.userID || payload.user || payload.sub || null
    );
  } catch (e) {
    return null;
  }
}

export default function Home({ onLogout }) {
  // UI state
  const [reportMode, setReportMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Modal State
  const [selectedReport, setSelectedReport] = useState(null);

  // form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // feed data
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  // per-report UI (Responses)
  const [responsesMap, setResponsesMap] = useState({});
  const [newComment, setNewComment] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const uid = t ? getUserIdFromToken(t) : null;
    setCurrentUserId(uid);
  }, []);

  async function loadNearby(lat = 18.5204, lng = 73.8567) {
    try {
      setLoading(true);
      const res = await api.get(`/reports/nearby?lat=${lat}&lng=${lng}`);
      const arr = res.data.reports || [];
      arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setReports(arr);
    } catch (err) {
      console.error("Nearby API failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      connectSocket();
    } catch (e) {}
    const s = getSocket();
    socketRef.current = s;

    function onNewReport(payload) {
      setReports((prev) => [payload, ...prev]);
    }

    function onReportResponse(payload) {
      const { reportId, response } = payload;
      setResponsesMap((m) => ({
        ...m,
        [reportId]: [...(m[reportId] || []), response],
      }));
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r } : r))
      );
      setSelectedReport((prev) => (prev && prev.id === reportId ? { ...prev } : prev));
    }

    function onReportClaimed(payload) {
      const { reportId } = payload;
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: "claimed" } : r))
      );
    }

    function onReportStatus(payload) {
      const { reportId, status } = payload;
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
      setSelectedReport((prev) => (prev && prev.id === reportId ? { ...prev, status } : prev));
    }

    if (s) {
      s.on("new_report", onNewReport);
      s.on("report_response", onReportResponse);
      s.on("report_claimed", onReportClaimed);
      s.on("report_status", onReportStatus);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => loadNearby(pos.coords.latitude, pos.coords.longitude),
      () => loadNearby()
    );

    return () => {
      if (s) {
        s.off("new_report", onNewReport);
        s.off("report_response", onReportResponse);
        s.off("report_claimed", onReportClaimed);
        s.off("report_status", onReportStatus);
      }
    };
  }, []);

  function handleMapSelect(loc) {
    setSelectedLocation(loc);
    setShowForm(true);
    setTimeout(() => {
      const el = document.getElementById("report-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }

  function handleFilesSelected(files) {
    const arr = Array.from(files);
    setPhotos((p) => [...p, ...arr]);
  }
  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function closeReportForm() {
    setShowForm(false);
    setReportMode(false);
    setSelectedLocation(null);
    setTitle("");
    setDescription("");
    setSeverity(1);
    setPhotos([]);
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!selectedLocation) {
      alert("Please pick a location on the map first.");
      return;
    }
    if (!title) {
      alert("Please provide a title.");
      return;
    }

    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description || "");
    fd.append("severity", severity);
    fd.append("latitude", selectedLocation.lat);
    fd.append("longitude", selectedLocation.lng);
    fd.append("category", "general");

    photos.forEach((f) => fd.append("photo", f));

    try {
      setSubmitting(true);
      const res = await api.post("/reports", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newReport = res.data.report;
      setReports((p) => [newReport, ...p]);
      closeReportForm();
      alert("Report submitted.");
    } catch (err) {
      console.error("Submit failed:", err);
      alert(err?.response?.data?.error || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Modal Logic ---
  async function openReportModal(report) {
    setSelectedReport(report);
    if (!responsesMap[report.id]) {
        try {
            const res = await api.get(`/reports/${report.id}/responses`);
            const arr = res.data.responses || [];
            setResponsesMap((m) => ({ ...m, [report.id]: arr }));
        } catch (err) {
            console.warn("Could not load responses:", err);
        }
    }
  }

  async function postComment(reportId) {
    const text = (newComment[reportId] || "").trim();
    if (!text) return;
    try {
      const res = await api.post(`/reports/${reportId}/respond`, {
        message: text,
      });
      const resp = res.data.response;
      setResponsesMap((m) => ({
        ...m,
        [reportId]: [...(m[reportId] || []), resp],
      }));
      setNewComment((c) => ({ ...c, [reportId]: "" }));
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to post response");
    }
  }

  async function closeReport(report) {
    if (!confirm("Close this case permanently?")) return;
    try {
      await api.post(`/reports/${report.id}/status`, { status: "closed" });
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: "closed" } : r))
      );
      if(selectedReport && selectedReport.id === report.id) {
          setSelectedReport(prev => ({...prev, status: 'closed'}));
      }
      alert("Report closed.");
    } catch (err) {
      alert("Failed to close");
    }
  }

  function reportAutoCloseInfo(report) {
    const created = new Date(report.created_at).getTime();
    const now = Date.now();
    const diff = now - created;
    if (report.status !== "open") return null;
    if (diff >= THREE_DAYS_MS)
      return {
        autoClosed: true,
        daysAgo: Math.floor(diff / (24 * 60 * 60 * 1000)),
      };
    const msLeft = THREE_DAYS_MS - diff;
    const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    return { autoClosed: false, daysLeft };
  }

  // FILTER LOGIC: Ensure map only gets open cases.
  // Using toLowerCase() to be safe against backend capitalization differences.
  const openReports = reports.filter(r => r.status && r.status.toLowerCase() === 'open');

  const EMERGENCY_CONTACTS = [
    {
      name: "Pune Animal Helpline",
      phone: "+91-XXXXXXXXXX",
      address: "Pune, Maharashtra",
      notes: "24x7 helpline",
    },
    {
      name: "Pune Pet Clinic - Central",
      phone: "+91-XXXXXXXXX",
      address: "MG Road, Pune",
    },
    {
      name: "Happy Paws Shelter",
      phone: "+91-XXXXXXXXX",
      address: "Kothrud, Pune",
    },
  ];

  return (
    <div className="home-wrapper">
      <style>{`
        .home-wrapper {
            font-family: sans-serif;
            font-size: 10px;
            color: #4a4a4a;
            background-color: #fff;
            min-height: 100vh;
            line-height: 1;
            padding: 20px;
            box-sizing: border-box;
        }
        
        /* --- TOP NAV BAR (User & Logout on Left) --- */
        .top-nav {
            display: flex;
            justify-content: flex-start; /* Align everything to start (left) */
            align-items: center;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
            margin-bottom: 25px;
            gap: 15px;
        }
        .nav-user-id {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            font-size: 11px;
            color: #222;
        }

        /* --- HEADER (Dashboard & [1]) --- */
        .home-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .home-header h1 {
            opacity: 1;
            font-family: sans-serif;
            font-weight: 500;
            font-size: 18px;
            letter-spacing: 0.5px;
            margin: 0;
            color: #222;
        }
        .chinese {
            font-family: 'Times New Roman', Times, serif;
            font-weight: 500;
            color: #333;
            margin-left: 5px;
        }
        .section-mark-header {
            font-size: 14px;
            font-weight: 500;
            color: #333;
        }

        /* --- LOGOUT BUTTON (Navbar Style) --- */
        .logout-btn-nav {
            background: transparent;
            border: 1px solid #d32f2f;
            color: #d32f2f;
            padding: 5px 10px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .logout-btn-nav:hover {
            background: #d32f2f;
            color: #fff;
        }

        /* Grid Layout */
        .dashboard-grid {
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
        }
        .col-left {
            flex: 2;
            min-width: 300px;
        }
        .col-right {
            flex: 1;
            min-width: 300px;
        }

        /* Section Titles */
        .section-title {
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 10px;
            color: #333;
            text-transform: uppercase;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .section-num {
            font-size: 100%;
        }

        /* Map & Actions */
        .map-frame {
            border: 1px solid #ddd;
            height: 60vh;
            margin-bottom: 15px;
            position: relative;
        }
        .action-bar {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .action-btn {
            background-color: transparent;
            border: 1px solid #ddd;
            color: #4a4a4a;
            padding: 10px 15px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .action-btn:hover {
            background-color: #f9f9f9;
            border-color: #999;
            color: #222;
        }
        .action-btn.primary {
            border-color: #4a4a4a;
            color: #222;
        }
        .action-btn.danger {
            color: #d32f2f;
            border-color: #ef9a9a;
        }
        
        /* Forms */
        .report-form-container {
            border: 1px solid #ddd;
            padding: 15px;
            margin-top: 20px;
        }
        .styled-input, .styled-select, .styled-textarea {
            width: 100%;
            padding: 10px;
            font-size: 11px;
            font-family: sans-serif;
            color: #4a4a4a;
            border: 1px solid #ddd;
            background: transparent;
            outline: none;
            box-sizing: border-box;
            margin-bottom: 10px;
        }
        .form-row { display: flex; gap: 10px; }

        /* Report Feed */
        .report-card {
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 15px;
            transition: border-color 0.3s ease;
        }
        .report-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .report-id {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            font-size: 11px;
            color: #222;
        }
        .report-status {
            font-size: 10px;
            text-transform: uppercase;
            border: 1px solid #eee;
            padding: 2px 5px;
        }
        .report-body {
            font-size: 11px;
            line-height: 1.4;
            margin-bottom: 10px;
        }
        .report-loc {
            font-size: 10px;
            color: #777;
            margin-bottom: 10px;
        }
        .severity-high { border-left: 3px solid #d32f2f; }
        .severity-med { border-left: 3px solid #fbc02d; }
        .severity-low { border-left: 3px solid #ddd; }

        /* Emergency Contacts */
        .emergency-box {
            border: 1px solid #ddd;
            padding: 15px;
            margin-top: 5px; 
        }
        .contact-item {
            border-bottom: 1px solid #eee;
            padding: 8px 0;
        }
        .contact-item:last-child { border-bottom: none; }
        
        /* Utils */
        .photo-preview {
            width: 60px;
            height: 60px;
            border: 1px solid #ddd;
            object-fit: cover;
            margin-right: 5px;
        }

        /* --- MODAL STYLES --- */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(2px);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .modal-box {
            background: #fff;
            width: 90%;
            max-width: 700px;
            height: 80vh;
            border: 2px solid #222;
            display: flex;
            flex-direction: column;
            box-shadow: 10px 10px 0px rgba(0,0,0,0.1);
        }
        .modal-header {
            padding: 15px;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #fafafa;
        }
        .modal-content-scroll {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        }
        .modal-image-grid {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin: 15px 0;
        }
        .modal-img {
            max-width: 100%;
            height: auto;
            max-height: 300px;
            border: 1px solid #ccc;
            display: block;
        }
        .chat-container {
            margin-top: 20px;
            border-top: 2px solid #eee;
            padding-top: 20px;
        }
        .chat-bubble {
            background: #f9f9f9;
            border: 1px solid #eee;
            padding: 10px;
            margin-bottom: 8px;
            font-size: 11px;
        }
      `}</style>

      {/* --- TOP NAV BAR (Top Left Corner: ID & Logout) --- */}
      <div className="top-nav">
          <span className="nav-user-id">
              {currentUserId ? `[ ID: ${currentUserId.slice(0, 8)} ]` : "[ GUEST ]"}
          </span>
          <button 
              className="logout-btn-nav"
              onClick={() => { if (onLogout) onLogout(); }}
          >
              LOG OUT
          </button>
      </div>

      {/* --- HEADER TITLE (Dashboard Left, [1] Right) --- */}
      <header className="home-header">
        <h1>
          Dashboard <span className="chinese">[仪 表 板]</span>
        </h1>
        <div className="section-mark-header">[1]</div>
      </header>

      <div className="dashboard-grid">
        {/* LEFT COLUMN: Map & Interactions */}
        <div className="col-left">
          <div className="section-title">
            [ LIVE MAP ] <span className="section-num">[2]</span>
          </div>

          <div className="map-frame">
            {/* CRITICAL FIX: Passing 'openReports' instead of 'reports'.
                openReports is filtered above to include ONLY status === 'open'.
            */}
            <MapView
              reports={openReports}
              reportMode={reportMode}
              onSelectLocation={handleMapSelect}
              selectedLocation={selectedLocation} 
            />
          </div>

          <div className="action-bar">
            <button
              onClick={() => {
                setReportMode(true);
                setShowForm(true);
                alert(
                  "Tap the map to choose report location. Form is below the map."
                );
              }}
              className="action-btn primary"
            >
              [ + REPORT CASE ]
            </button>

            <button
              onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  (pos) =>
                    loadNearby(pos.coords.latitude, pos.coords.longitude),
                  () => loadNearby()
                );
              }}
              className="action-btn"
            >
              REFRESH
            </button>
          </div>

          {/* Hidden/Shown Report Form */}
          {showForm && (
            <div id="report-form" className="report-form-container">
              <div className="section-title" style={{ marginBottom: "20px" }}>
                [ SUBMIT NEW REPORT ]
              </div>
              <form onSubmit={submitReport}>
                <div className="form-row">
                  <input
                    className="styled-input"
                    placeholder="Title (Short)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    style={{ flex: 2 }}
                  />
                  <select
                    className="styled-select"
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                    style={{ flex: 1 }}
                  >
                    <option value={1}>Low Severity</option>
                    <option value={2}>Medium Severity</option>
                    <option value={3}>High Severity</option>
                  </select>
                </div>

                <textarea
                  className="styled-textarea"
                  placeholder="Describe the situation..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <div style={{ marginBottom: "10px", fontSize: "11px" }}>
                  <span style={{ color: "#999" }}>LOCATION: </span>
                  {selectedLocation ? (
                    <span style={{ fontWeight: "bold" }}>
                      📍 {selectedLocation.lat.toFixed(5)},{" "}
                      {selectedLocation.lng.toFixed(5)}
                    </span>
                  ) : (
                    <span style={{ color: "#d32f2f" }}>
                      [ PLEASE TAP MAP ]
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontSize: "11px",
                    }}
                  >
                    PHOTOS:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    style={{ fontSize: "10px" }}
                  />
                  <div style={{ marginTop: "10px", display: "flex" }}>
                    {photos.map((f, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img
                          src={URL.createObjectURL(f)}
                          alt=""
                          className="photo-preview"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          style={{
                            position: "absolute",
                            top: 0,
                            right: "5px",
                            background: "black",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "10px",
                            padding: "2px 5px",
                          }}
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="action-btn primary"
                    style={{ flex: 1 }}
                  >
                    {submitting ? "SENDING..." : "CONFIRM REPORT"}
                  </button>
                  <button
                    type="button"
                    onClick={closeReportForm}
                    className="action-btn"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Feed & Contacts */}
        <div className="col-right">
          <div className="section-title">
            [ FEED ] <span className="section-num">[3]</span>
          </div>

          <div
            style={{
              maxHeight: "400px", /* Tuned for approx 3 cards */
              overflowY: "auto", 
              paddingRight: "5px",
            }}
          >
            {loading && <div>LOADING FEED...</div>}
            {reports.length === 0 && !loading && (
              <div style={{ color: "#999" }}>NO REPORTS NEARBY.</div>
            )}

            {reports.map((r) => {
              const autoInfo = reportAutoCloseInfo(r);
              return (
                <div
                  key={r.id}
                  className={`report-card ${severityClass(r.severity)}`}
                >
                  <div className="report-header">
                    <span className="report-id">
                      #{r.id.slice(0, 6).toUpperCase()}
                    </span>
                    <span className="report-status">{r.status}</span>
                  </div>
                  <div style={{ marginBottom: "5px", fontWeight: "bold" }}>
                    {r.title}
                  </div>
                  <div className="report-loc">
                    {formatDate(r.created_at)}
                  </div>
                  <div className="report-body" style={{ maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description}
                  </div>

                  <div className="action-bar" style={{ marginBottom: "0" }}>
                    <button
                      onClick={() => openReportModal(r)}
                      className="action-btn"
                      style={{ fontSize: "9px", padding: "5px 10px", width: '100%' }}
                    >
                      VIEW CASE DETAILS
                    </button>
                  </div>

                  {autoInfo && (
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "9px",
                        textAlign: "right",
                        color: autoInfo.autoClosed ? "#d32f2f" : "#999",
                      }}
                    >
                      {autoInfo.autoClosed
                        ? `EXPIRED (${autoInfo.daysAgo}D AGO)`
                        : `EXPIRES IN ${autoInfo.daysLeft}D`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="section-title" style={{ marginTop: "30px" }}>
              [ HELP ] <span className="section-num">[4]</span>
          </div>
          <div className="emergency-box">
            <div style={{ marginBottom: "15px" }}>
              <div style={{ fontWeight: "bold" }}>HELPLINE</div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#d32f2f",
                  fontFamily: "Courier New, monospace",
                }}
              >
                +91-XXXXXXXXXX
              </div>
            </div>
            {EMERGENCY_CONTACTS.map((c, i) => (
              <div key={i} className="contact-item">
                <div style={{ fontWeight: "600" }}>{c.name}</div>
                <div style={{ fontSize: "9px", color: "#777" }}>
                  {c.address}
                </div>
                <div style={{ marginTop: "2px" }}>{c.phone}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- POPUP MODAL --- */}
      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span style={{fontWeight: 'bold'}}>
                        CASE #{selectedReport.id.slice(0, 6).toUpperCase()}
                    </span>
                    <button onClick={() => setSelectedReport(null)} className="action-btn">
                        CLOSE [X]
                    </button>
                </div>
                <div className="modal-content-scroll">
                    {/* DETAILS */}
                    <div className="form-row" style={{justifyContent: 'space-between', marginBottom: '10px'}}>
                         <div style={{ fontSize: "14px", fontWeight: "bold" }}>{selectedReport.title}</div>
                         <div className={`report-status ${severityClass(selectedReport.severity)}`}>
                             {selectedReport.status}
                         </div>
                    </div>
                    
                    <div style={{fontSize: '11px', color: '#666', marginBottom: '15px'}}>
                        REPORTED: {formatDate(selectedReport.created_at)} <br/>
                        LOCATION: {selectedReport.location_text || `${selectedReport.latitude}, ${selectedReport.longitude}`}
                    </div>

                    <div style={{fontSize: '12px', lineHeight: '1.5', marginBottom: '20px'}}>
                        {selectedReport.description}
                    </div>

                    {/* IMAGES */}
                    {selectedReport.photos && selectedReport.photos.length > 0 && (
                        <div>
                            <div className="section-title" style={{borderBottom: '1px solid #eee'}}>[ EVIDENCE PHOTOS ]</div>
                            <div className="modal-image-grid">
                                {selectedReport.photos.map((url, idx) => (
                                    <img key={idx} src={url} alt="Report evidence" className="modal-img" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CHAT/RESPONSE SECTION */}
                    <div className="chat-container">
                        <div className="section-title">[ LIVE UPDATES / CHAT ]</div>
                        
                        {(responsesMap[selectedReport.id] || []).length === 0 && (
                            <div style={{ color: "#999", margin: "10px 0" }}>
                              NO RESPONSES YET.
                            </div>
                        )}
                        
                        {(responsesMap[selectedReport.id] || []).map((resp, i) => (
                             <div key={i} className="chat-bubble">
                                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#999', fontSize: '9px'}}>
                                    <span>USER: {resp.responder_id ? resp.responder_id.slice(0,5) : 'ANON'}</span>
                                    <span>{formatDate(resp.created_at)}</span>
                                </div>
                                <div>{resp.message}</div>
                             </div>
                        ))}

                        <div className="form-row" style={{ marginTop: "15px" }}>
                            <input
                              value={newComment[selectedReport.id] || ""}
                              onChange={(e) =>
                                setNewComment((m) => ({
                                  ...m,
                                  [selectedReport.id]: e.target.value,
                                }))
                              }
                              placeholder="Type update message..."
                              className="styled-input"
                              style={{ marginBottom: 0 }}
                            />
                            <button
                              onClick={() => postComment(selectedReport.id)}
                              className="action-btn primary"
                            >
                              SEND
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modal Footer Actions */}
                <div style={{padding: '15px', borderTop: '1px solid #ddd', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                     {currentUserId && selectedReport.reporter_id === currentUserId && selectedReport.status === 'open' && (
                         <button onClick={() => closeReport(selectedReport)} className="action-btn danger">
                             MARK AS RESOLVED & CLOSE
                         </button>
                     )}
                     <button onClick={() => {
                         const msg = prompt("Quick response message:");
                         if(msg) {
                             setNewComment(p => ({...p, [selectedReport.id]: msg}));
                             setTimeout(() => postComment(selectedReport.id), 100);
                         }
                     }} className="action-btn">
                         QUICK RESPOND
                     </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}