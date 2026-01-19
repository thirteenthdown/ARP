// src/pages/Home.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MapView from "../components/MapView";
import api from "../lib/api";
import { getSocket, connectSocket } from "../lib/socket";
import dayjs from "dayjs";

/**
 * Home (Animal Rescue Hub)
 * Updated: Passed 'openReportModal' to MapView for popup interaction.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"; 

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

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
  const navigate = useNavigate();

  // UI state
  const [reportMode, setReportMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Locations
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Modal State
  const [selectedReport, setSelectedReport] = useState(null);

  // Form fields
  const [animalType, setAnimalType] = useState("DOG"); 
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState(""); 
  const [severity, setSeverity] = useState(1);
  const [mediaFiles, setMediaFiles] = useState([]); 
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [responsesMap, setResponsesMap] = useState({});
  const [newComment, setNewComment] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const uid = t ? getUserIdFromToken(t) : null;
    setCurrentUserId(uid);
  }, []);

  async function loadNearby() {
    try {
      setLoading(true);
      // Fetch GLOBAL feed (all reports) regardless of location
      const res = await api.get(`/reports/nearby?global=true`);
      const arr = res.data.reports || [];
      
      // Ensure specific sorting if needed (backend does it too)
      arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setReports(arr);
    } catch (err) {
      console.error("Data load failed:", err);
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
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        loadNearby(latitude, longitude);
      },
      () => {
        loadNearby();
        setUserLocation({ lat: 18.5204, lng: 73.8567 });
      }
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
    setMediaFiles((p) => [...p, ...arr]);
  }
  function removeMedia(index) {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function closeReportForm() {
    setShowForm(false);
    setReportMode(false);
    setSelectedLocation(null);
    setTitle("");
    setDescription("");
    setAddress("");
    setAnimalType("DOG");
    setSeverity(1);
    setMediaFiles([]);
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
    
    // New Fields
    fd.append("animal_type", animalType);
    fd.append("address", address);
    fd.append("category", "general"); 

    mediaFiles.forEach((f) => fd.append("media", f));

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

  const openReports = reports.filter(r => {
    const isOpen = r.status && r.status.toLowerCase() === 'open';
    const created = new Date(r.created_at).getTime();
    const isExpired = (Date.now() - created) >= THREE_DAYS_MS;
    return isOpen && !isExpired;
  });

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
        .top-nav { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 25px; }
        .nav-links { display: flex; gap: 20px; }
        .nav-link-item { font-size: 11px; font-weight: 500; color: #777; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; transition: color 0.2s; }
        .nav-link-item:hover { color: #000; }
        .nav-link-item.active { font-weight: 700; color: #000; border-bottom: 2px solid #000; padding-bottom: 2px; }
        .nav-right { display: flex; align-items: center; gap: 15px; }
        .nav-user-id { font-family: 'Courier New', monospace; font-weight: bold; font-size: 11px; color: #222; }
        .logout-btn-nav { background: transparent; border: 1px solid #d32f2f; color: #d32f2f; padding: 5px 10px; font-weight: bold; text-transform: uppercase; font-size: 9px; cursor: pointer; transition: all 0.2s; }
        .logout-btn-nav:hover { background: #d32f2f; color: #fff; }
        .home-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .home-header h1 { opacity: 1; font-family: sans-serif; font-weight: 500; font-size: 18px; letter-spacing: 0.5px; margin: 0; color: #222; }
        .chinese { font-family: 'Times New Roman', Times, serif; font-weight: 500; color: #333; margin-left: 5px; }
        .section-mark-header { font-size: 14px; font-weight: 500; color: #333; }
        .dashboard-grid { display: flex; gap: 30px; flex-wrap: wrap; }
        .col-left { flex: 2; min-width: 300px; }
        .col-right { flex: 1; min-width: 300px; }
        .section-title { font-size: 12px; font-weight: 500; margin-bottom: 10px; color: #333; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; }
        .section-num { font-size: 100%; }
        .map-frame { border: 1px solid #ddd; height: 60vh; margin-bottom: 15px; position: relative; }
        .action-bar { display: flex; gap: 10px; margin-bottom: 20px; }
        .action-btn { background-color: transparent; border: 1px solid #ddd; color: #4a4a4a; padding: 10px 15px; font-size: 11px; font-weight: 600; text-transform: uppercase; cursor: pointer; transition: all 0.3s ease; }
        .action-btn:hover { background-color: #f9f9f9; border-color: #999; color: #222; }
        .action-btn.primary { border-color: #4a4a4a; color: #222; }
        .action-btn.danger { color: #d32f2f; border-color: #ef9a9a; }
        .report-form-container { border: 1px solid #ddd; padding: 15px; margin-top: 20px; }
        
        .styled-input, .styled-select, .styled-textarea { width: 100%; padding: 10px; font-size: 13px; font-family: sans-serif; color: #4a4a4a; border: 1px solid #ddd; background: transparent; outline: none; box-sizing: border-box; margin-bottom: 10px; }
        .form-row { display: flex; gap: 10px; }
        
        /* FEED CARD SIZES */
        .report-card { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; transition: border-color 0.3s ease; }
        .report-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .report-id { font-family: 'Courier New', monospace; font-weight: bold; font-size: 13px; color: #222; }
        .report-status { font-size: 11px; text-transform: uppercase; border: 1px solid #eee; padding: 2px 5px; }
        .report-body { font-size: 13px; line-height: 1.4; margin-bottom: 10px; }
        .report-loc { font-size: 12px; color: #777; margin-bottom: 10px; }
        
        .severity-high { border-left: 3px solid #d32f2f; }
        .severity-med { border-left: 3px solid #fbc02d; }
        .severity-low { border-left: 3px solid #ddd; }
        .emergency-box { border: 1px solid #ddd; padding: 15px; margin-top: 5px; }
        .contact-item { border-bottom: 1px solid #eee; padding: 8px 0; }
        .contact-item:last-child { border-bottom: none; }
        .photo-preview { width: 60px; height: 60px; border: 1px solid #ddd; object-fit: cover; margin-right: 5px; }
        
        /* --- UPDATED MODAL STYLES --- */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(255, 255, 255, 0.85); backdrop-filter: blur(2px); z-index: 9999; display: flex; justify-content: center; align-items: center; }
        .modal-box { 
            background: #fff; 
            width: 90%; 
            max-width: 600px; 
            height: 70vh;    
            border: 2px solid #222; 
            display: flex; 
            flex-direction: column; 
            box-shadow: 10px 10px 0px rgba(0,0,0,0.1); 
        }
        .modal-header { padding: 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; background: #fafafa; }
        .modal-content-scroll { padding: 20px; overflow-y: auto; flex: 1; }
        .modal-image-grid { display: flex; gap: 10px; flex-wrap: wrap; margin: 15px 0; }
        .modal-img { max-width: 100%; height: auto; max-height: 250px; border: 1px solid #ccc; display: block; }
        .chat-container { margin-top: 20px; border-top: 2px solid #eee; padding-top: 20px; }
        
        /* CHAT BUBBLE SIZE */
        .chat-bubble { background: #f9f9f9; border: 1px solid #eee; padding: 10px; margin-bottom: 8px; font-size: 13px; }
        
        .form-label { display: block; font-size: 12px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; color: #555; }
        
        /* Location Link & Tooltip */
        .location-link {
            font-weight: bold;
            color: #222;
            text-decoration: none;
            cursor: pointer;
            position: relative;
            transition: color 0.2s;
            border-bottom: 1px dashed #999;
        }
        .location-link:hover {
            color: #d32f2f;
            border-bottom-style: solid;
        }
        .tooltip-text {
            visibility: hidden;
            background-color: #222;
            color: #fff;
            text-align: center;
            border-radius: 4px;
            padding: 5px 10px;
            position: absolute;
            z-index: 1;
            bottom: 125%; /* Position above */
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 10px;
            white-space: nowrap;
            letter-spacing: 0.5px;
            pointer-events: none;
            box-shadow: 0px 4px 8px rgba(0,0,0,0.2);
        }
        .tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #222 transparent transparent transparent;
        }
        .location-link:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
        }
      `}</style>

      {/* --- TOP NAV BAR --- */}
      <div className="top-nav">
          <div className="nav-links">
              <span className="nav-link-item active" onClick={() => navigate("/")}>RESCUE</span>
              <span className="nav-link-item" onClick={() => navigate("/blogs")}>BLOGS</span>
              <span className="nav-link-item" onClick={() => navigate("/profile")}>MY PROFILE</span>
          </div>
          <div className="nav-right">
              <span className="nav-user-id">
                  {currentUserId ? `[ ID: ${currentUserId.slice(0, 8)} ]` : "[ GUEST ]"}
              </span>
              <button className="logout-btn-nav" onClick={() => { if (onLogout) onLogout(); }}>LOG OUT</button>
          </div>
      </div>

      <header className="home-header">
        <h1>Dashboard <span className="chinese">[仪 表 板]</span></h1>
        <div className="section-mark-header">[1]</div>
      </header>

      <div className="dashboard-grid">
        <div className="col-left">
          <div className="section-title">[ LIVE MAP ] <span className="section-num">[2]</span></div>
          <div className="map-frame">
            <MapView
              reports={openReports}
              userLocation={userLocation} 
              reportMode={reportMode}
              onSelectLocation={handleMapSelect}
              selectedLocation={selectedLocation} 
              onViewReport={openReportModal} // PASSED PROP FOR POPUP BUTTON
            />
          </div>

          <div className="action-bar">
            <button
              onClick={() => { setReportMode(true); setShowForm(true); alert("Tap the map to choose report location."); }}
              className="action-btn primary"
            >
              [ + REPORT CASE ]
            </button>
            <button onClick={() => { navigator.geolocation.getCurrentPosition((pos) => loadNearby(pos.coords.latitude, pos.coords.longitude), () => loadNearby()); }} className="action-btn">REFRESH</button>
          </div>

          {showForm && (
            <div id="report-form" className="report-form-container">
              <div className="section-title" style={{ marginBottom: "20px" }}>[ SUBMIT NEW REPORT ]</div>
              <form onSubmit={submitReport}>
                {/* 1. Animal Selection */}
                <div style={{marginBottom: '10px'}}>
                    <label className="form-label">ANIMAL</label>
                    <select
                        className="styled-select"
                        value={animalType}
                        onChange={(e) => setAnimalType(e.target.value)}
                    >
                        <option value="DOG">DOG</option>
                        <option value="CAT">CAT</option>
                        <option value="BIRD">BIRD</option>
                        <option value="CATTLE">CATTLE</option>
                        <option value="OTHER">OTHER</option>
                    </select>
                </div>

                {/* 2. Title & Severity */}
                <div className="form-row">
                  <div style={{flex: 2}}>
                      <label className="form-label">TITLE (SHORT)</label>
                      <input
                        className="styled-input"
                        placeholder="e.g. Injured Dog"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                  </div>
                  <div style={{flex: 1}}>
                      <label className="form-label">SEVERITY</label>
                      <select
                        className="styled-select"
                        value={severity}
                        onChange={(e) => setSeverity(Number(e.target.value))}
                      >
                        <option value={1}>LOW</option>
                        <option value={2}>MEDIUM</option>
                        <option value={3}>HIGH</option>
                      </select>
                  </div>
                </div>

                {/* 3. Description */}
                <div>
                    <label className="form-label">DESCRIPTION</label>
                    <textarea
                      className="styled-textarea"
                      placeholder="Describe the situation..."
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                {/* 4. Address */}
                <div>
                    <label className="form-label">ADDRESS / LANDMARK</label>
                    <input
                      className="styled-input"
                      placeholder="Street name, Area, Landmark..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                </div>

                <div style={{ marginBottom: "10px", fontSize: "11px" }}>
                  <span style={{ color: "#999" }}>MAP LOCATION: </span>
                  {selectedLocation ? (
                    <span style={{ fontWeight: "bold" }}>📍 {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}</span>
                  ) : (
                    <span style={{ color: "#d32f2f" }}>[ PLEASE TAP MAP ]</span>
                  )}
                </div>

                {/* 5. Media Upload */}
                <div style={{ marginBottom: "15px" }}>
                  <label className="form-label">MEDIA (PHOTOS/VIDEOS)</label>
                  <div style={{display:'flex', gap:'10px', marginBottom: '10px'}}>
                      <label className="action-btn" style={{flex:1, textAlign:'center'}}>
                          ADD MEDIA
                          <input type="file" accept="image/*,video/*" multiple hidden onChange={e => handleFilesSelected(e.target.files)} />
                      </label>
                  </div>
                  <div style={{ display: "flex", gap:'5px', flexWrap:'wrap' }}>
                    {mediaFiles.map((f, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        {f.type.startsWith('video') ? (
                            <video src={URL.createObjectURL(f)} className="photo-preview" />
                        ) : (
                            <img src={URL.createObjectURL(f)} className="photo-preview" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(i)}
                          style={{ position: "absolute", top: 0, right: 0, background: "black", color: "white", border: "none", cursor: "pointer", fontSize: "10px", padding: "2px 5px" }}
                        >X</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <button type="submit" disabled={submitting} className="action-btn primary" style={{ flex: 1 }}>{submitting ? "SENDING..." : "CONFIRM REPORT"}</button>
                  <button type="button" onClick={closeReportForm} className="action-btn">CANCEL</button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="col-right">
          <div className="section-title">[ FEED ] <span className="section-num">[3]</span></div>
          <div style={{ maxHeight: "440px", overflowY: "auto", paddingRight: "5px" }}>
            {loading && <div>LOADING FEED...</div>}
            {reports.length === 0 && !loading && <div style={{ color: "#999" }}>NO REPORTS NEARBY.</div>}

            {reports.map((r) => {
              const autoInfo = reportAutoCloseInfo(r);
              return (
                <div key={r.id} className={`report-card ${severityClass(r.severity)}`}>
                  <div className="report-header">
                    <span className="report-id">#{r.id.slice(0, 6).toUpperCase()}</span>
                    <span className="report-status">{r.status}</span>
                  </div>
                  {/* Animal Type Badge */}
                  <div style={{display:'inline-block', background:'#eee', padding:'2px 6px', fontSize:'10px', fontWeight:'bold', marginBottom:'5px', borderRadius:'4px'}}>
                      {r.animal_type || 'ANIMAL'}
                  </div>
                  <div style={{ marginBottom: "5px", fontWeight: "bold", fontSize: "15px" }}>{r.title}</div>
                  <div className="report-loc">
                      {formatDate(r.created_at)} <br/>
                      {r.address && <span style={{color: '#444'}}>📍 {r.address}</span>}
                  </div>
                  <div className="report-body" style={{ maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                  
                  <div className="action-bar" style={{ marginBottom: "0" }}>
                    <button onClick={() => openReportModal(r)} className="action-btn" style={{ fontSize: "11px", padding: "5px 10px", width: '100%' }}>VIEW CASE DETAILS</button>
                  </div>
                  {autoInfo && (
                    <div style={{ marginTop: "5px", fontSize: "11px", textAlign: "right", color: autoInfo.autoClosed ? "#d32f2f" : "#999" }}>
                      {autoInfo.autoClosed ? `EXPIRED (${autoInfo.daysAgo}D AGO)` : `EXPIRES IN ${autoInfo.daysLeft}D`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="section-title" style={{ marginTop: "30px" }}>[ HELP ] <span className="section-num">[4]</span></div>
          <div className="emergency-box">
            <div style={{ marginBottom: "15px" }}>
              <div style={{ fontWeight: "bold" }}>HELPLINE</div>
              <div style={{ fontSize: "18px", color: "#d32f2f", fontFamily: "Courier New, monospace" }}>+91-XXXXXXXXXX</div>
            </div>
            {EMERGENCY_CONTACTS.map((c, i) => (
              <div key={i} className="contact-item">
                <div style={{ fontWeight: "600", fontSize: "14px" }}>{c.name}</div>
                <div style={{ fontSize: "12px", color: "#777" }}>{c.address}</div>
                <div style={{ marginTop: "2px", fontSize: "12px" }}>{c.phone}</div>
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
                    <span style={{fontWeight: 'bold', fontSize: '16px'}}>CASE #{selectedReport.id.slice(0, 6).toUpperCase()}</span>
                    <button onClick={() => setSelectedReport(null)} className="action-btn">CLOSE [X]</button>
                </div>
                <div className="modal-content-scroll">
                    <div className="form-row" style={{justifyContent: 'space-between', marginBottom: '10px'}}>
                         <div style={{ fontSize: "16px", fontWeight: "bold" }}>{selectedReport.title}</div>
                         <div className={`report-status ${severityClass(selectedReport.severity)}`}>{selectedReport.status}</div>
                    </div>
                    
                    <div style={{fontSize: '11px', color: '#666', marginBottom: '15px'}}>
                        REPORTED: {formatDate(selectedReport.created_at)} <br/>
                        ANIMAL: {selectedReport.animal_type || 'N/A'} <br/>
                        ADDRESS: {selectedReport.address || 'N/A'} <br/>
                        <div style={{ display: 'inline-block', marginTop: '2px' }}>
                          <span style={{ color: '#666' }}>LOCATION: </span>
                          <a 
                            href={`https://www.google.com/maps?q=${selectedReport.latitude},${selectedReport.longitude}`}
                            target="_blank" 
                            rel="noreferrer"
                            className="location-link"
                          >
                            {selectedReport.location_text || `${selectedReport.latitude}, ${selectedReport.longitude}`}
                            <span className="tooltip-text">Open this at Google Maps ↗</span>
                          </a>
                        </div>
                    </div>

                    <div style={{fontSize: '12px', lineHeight: '1.5', marginBottom: '20px'}}>{selectedReport.description}</div>

                    {/* IMAGES */}
                    {selectedReport.photos && selectedReport.photos.length > 0 && (
                        <div>
                            <div className="section-title" style={{borderBottom: '1px solid #eee'}}>[ EVIDENCE PHOTOS ]</div>
                            <div className="modal-image-grid">
                                {selectedReport.photos.map((filename, idx) => (
                                    <img key={idx} src={`${API_URL}/uploads/${filename}`} alt="Report evidence" className="modal-img" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* VIDEOS */}
                    {selectedReport.videos && selectedReport.videos.length > 0 && (
                        <div>
                            <div className="section-title" style={{borderBottom: '1px solid #eee', marginTop:'15px'}}>[ EVIDENCE VIDEOS ]</div>
                            <div className="modal-image-grid">
                                {selectedReport.videos.map((filename, idx) => (
                                    <video key={idx} src={`${API_URL}/uploads/${filename}`} controls className="modal-img" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CHAT/RESPONSE SECTION */}
                    <div className="chat-container">
                        <div className="section-title">[ LIVE UPDATES / CHAT ]</div>
                        {(responsesMap[selectedReport.id] || []).length === 0 && <div style={{ color: "#999", margin: "10px 0" }}>NO RESPONSES YET.</div>}
                        
                        {(responsesMap[selectedReport.id] || []).map((resp, i) => {
                             const isReporter = resp.volunteer_id === selectedReport.reporter_id;
                             const userLabel = isReporter ? '[REPORTER]' : `USER: ${resp.volunteer_id ? resp.volunteer_id.slice(0,5) : 'ANON'}`;
                             return (
                               <div key={i} className="chat-bubble" style={isReporter ? {borderLeft: '3px solid #222'} : {}}>
                                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#999', fontSize: '11px'}}>
                                      <span style={isReporter ? {fontWeight:'bold', color: '#000'} : {}}>{userLabel}</span>
                                      <span>{formatDate(resp.created_at)}</span>
                                  </div>
                                  <div>{resp.message}</div>
                               </div>
                             );
                        })}

                        <div className="form-row" style={{ marginTop: "15px" }}>
                            <input value={newComment[selectedReport.id] || ""} onChange={(e) => setNewComment((m) => ({ ...m, [selectedReport.id]: e.target.value, }))} placeholder="Type update message..." className="styled-input" style={{ marginBottom: 0 }} />
                            <button onClick={() => postComment(selectedReport.id)} className="action-btn primary">SEND</button>
                        </div>
                    </div>
                </div>

                <div style={{padding: '15px', borderTop: '1px solid #ddd', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                     {currentUserId && selectedReport.reporter_id === currentUserId && selectedReport.status === 'open' && (
                         <button onClick={() => closeReport(selectedReport)} className="action-btn danger">MARK AS RESOLVED & CLOSE</button>
                     )}
                     <button onClick={() => {
                         const msg = prompt("Quick response message:");
                         if(msg) {
                             setNewComment(p => ({...p, [selectedReport.id]: msg}));
                             setTimeout(() => postComment(selectedReport.id), 100);
                         }
                     }} className="action-btn">QUICK RESPOND</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}