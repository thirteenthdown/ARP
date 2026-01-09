import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../lib/api";

// Same Avatars list for editing
const AVATARS = [
  "/bird.png",
  "/fox.png",
  "/panda.png",
  "/rabbit.png",
];

// Helper for date formatting
const formatDate = (iso) => dayjs(iso).format("MMM D, YYYY HH:mm");
const API_URL = "http://localhost:3000";

export default function MyProfile({ onLogout }) {
  const navigate = useNavigate();

  // Data States
  const [user, setUser] = useState(null);
  const [myReports, setMyReports] = useState([]);
  const [myBlogs, setMyBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [activeTab, setActiveTab] = useState("details"); // details | reports | blogs
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  
  // Modals
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportResponses, setReportResponses] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  async function fetchProfileData() {
    setLoading(true);
    try {
      // 1. Fetch User Details
      const uRes = await api.get("/auth/me");
      setUser(uRes.data.user);
      setEditForm(uRes.data.user); // Initialize edit form

      // 2. Fetch User Reports
      const rRes = await api.get("/reports/mine");
      setMyReports(rRes.data.reports || []);

      // 3. Fetch User Blogs
      const bRes = await api.get("/blogs/mine");
      setMyBlogs(bRes.data.blogs || []);
    } catch (err) {
      console.error("Failed to load profile data", err);
    } finally {
      setLoading(false);
    }
  }

  // --- HANDLERS ---

  async function handleUpdateProfile(e) {
    e.preventDefault();
    try {
      await api.put("/auth/me", editForm);
      setUser(editForm);
      setIsEditing(false);
      alert("Profile updated successfully.");
    } catch (err) {
      alert("Failed to update profile.");
    }
  }

  async function openReportModal(report) {
    setSelectedReport(report);
    // Fetch chat history for this report
    try {
      const res = await api.get(`/reports/${report.id}/responses`);
      setReportResponses(res.data.responses || []);
    } catch (err) {
      console.warn("Failed to load chats");
    }
  }

  // --- RENDER HELPERS ---

  if (loading) return <div style={{padding: 40, fontFamily: 'sans-serif', fontSize: '10px'}}>LOADING PROFILE...</div>;

  return (
    <div className="profile-wrapper">
       <style>{`
        .profile-wrapper {
            font-family: sans-serif;
            font-size: 10px;
            color: #4a4a4a;
            background-color: #fff;
            min-height: 100vh;
            line-height: 1;
            padding: 20px;
            box-sizing: border-box;
        }
        /* Top Nav (Reused) */
        .top-nav { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 25px; }
        .nav-links { display: flex; gap: 20px; }
        .nav-link-item { font-size: 11px; font-weight: 500; color: #777; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; transition: color 0.2s; }
        .nav-link-item:hover { color: #000; }
        .nav-link-item.active { font-weight: 700; color: #000; border-bottom: 2px solid #000; padding-bottom: 2px; }
        .logout-btn-nav { background: transparent; border: 1px solid #d32f2f; color: #d32f2f; padding: 5px 10px; font-weight: bold; text-transform: uppercase; font-size: 9px; cursor: pointer; }
        .logout-btn-nav:hover { background: #d32f2f; color: #fff; }

        /* Profile Header Area */
        .profile-header-container {
            display: flex;
            justify-content: space-between; /* Space between left empty area and right profile */
            align-items: flex-start;
            margin-bottom: 40px;
        }
        .header-left-space {
            flex: 1;
            /* Keeps the left side empty as requested */
        }
        .header-user-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            text-align: right;
        }
        .user-avatar-lg {
            width: 80px;
            height: 80px;
            border: 2px solid #222;
            image-rendering: pixelated;
            margin-bottom: 10px;
            background: #f9f9f9;
        }
        .user-username-lg {
            font-size: 24px;
            font-weight: 500;
            color: #222;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }
        .user-id-sm {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #999;
        }

        /* Tabs */
        .tabs-row {
            display: flex;
            gap: 30px;
            border-bottom: 1px solid #eee;
            margin-bottom: 30px;
        }
        .tab-btn {
            background: none;
            border: none;
            font-family: sans-serif;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #999;
            padding-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .tab-btn:hover { color: #555; }
        .tab-btn.active {
            color: #222;
            border-bottom: 2px solid #222;
        }

        /* Sections */
        .section-container { max-width: 800px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .form-group { margin-bottom: 15px; }
        .form-label { display: block; font-size: 10px; font-weight: bold; color: #555; margin-bottom: 5px; text-transform: uppercase; }
        .styled-input { width: 100%; padding: 10px; font-size: 12px; border: 1px solid #ddd; outline: none; background: #fff; }
        .styled-input:disabled { background: #f9f9f9; color: #777; border-color: #eee; }
        
        .list-item {
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            transition: background 0.2s;
        }
        .list-item:hover { background: #fafafa; border-color: #bbb; }
        .item-status { font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 3px 6px; background: #eee; margin-bottom: 5px; display: inline-block; }
        .item-title { font-size: 14px; font-weight: 600; color: #222; margin-bottom: 5px; }
        .item-date { font-size: 10px; color: #999; }

        /* Action Buttons */
        .action-btn {
            background: transparent;
            border: 1px solid #222;
            color: #222;
            padding: 10px 20px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            text-transform: uppercase;
        }
        .action-btn:hover { background: #222; color: #fff; }
        .action-btn.secondary { border-color: #ddd; color: #777; }
        .action-btn.secondary:hover { border-color: #999; color: #222; background: transparent; }

        /* Modal Styles (Reused) */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(255,255,255,0.9); z-index: 999; display: flex; justify-content: center; align-items: center; }
        .modal-box { background: #fff; width: 90%; max-width: 600px; height: 80vh; border: 2px solid #222; display: flex; flex-direction: column; box-shadow: 10px 10px 0 rgba(0,0,0,0.1); }
        .modal-header { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
        .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
        .chat-bubble { background: #f5f5f5; padding: 10px; margin-bottom: 8px; font-size: 12px; border-left: 2px solid #ddd; }
       `}</style>

      {/* --- NAV --- */}
      <div className="top-nav">
          <div className="nav-links">
              <span className="nav-link-item" onClick={() => navigate("/")}>RESCUE</span>
              <span className="nav-link-item" onClick={() => navigate("/blogs")}>BLOGS</span>
              <span className="nav-link-item active" onClick={() => navigate("/profile")}>MY PROFILE</span>
          </div>
          <button className="logout-btn-nav" onClick={() => { if (onLogout) onLogout(); }}>LOG OUT</button>
      </div>

      {/* --- PROFILE HEADER --- */}
      <div className="profile-header-container">
          <div className="header-left-space">
              {/* Empty Space as requested */}
          </div>
          
          {user && (
            <div className="header-user-info">
                <img src={user.avatar} alt="Avatar" className="user-avatar-lg" />
                <div className="user-username-lg">{user.username}</div>
                <div className="user-id-sm">ID: {user.id}</div>
            </div>
          )}
      </div>

      {/* --- TABS --- */}
      <div className="tabs-row">
          <button 
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} 
            onClick={() => setActiveTab('details')}
          >
            [1] My Details
          </button>
          <button 
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`} 
            onClick={() => setActiveTab('reports')}
          >
            [2] My Submitted Reports
          </button>
          <button 
            className={`tab-btn ${activeTab === 'blogs' ? 'active' : ''}`} 
            onClick={() => setActiveTab('blogs')}
          >
            [3] My Blogs
          </button>
      </div>

      {/* --- CONTENT --- */}
      <div className="section-container">
          
          {/* 1. MY DETAILS TAB */}
          {activeTab === 'details' && user && (
              <div>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                      <div className="form-label" style={{fontSize:'14px'}}>[ PERSONAL INFORMATION ]</div>
                      {!isEditing ? (
                          <button onClick={() => setIsEditing(true)} className="action-btn">EDIT DETAILS</button>
                      ) : (
                          <div style={{display:'flex', gap:'10px'}}>
                              <button onClick={handleUpdateProfile} className="action-btn">SAVE CHANGES</button>
                              <button onClick={() => { setIsEditing(false); setEditForm(user); }} className="action-btn secondary">CANCEL</button>
                          </div>
                      )}
                  </div>

                  <div className="form-grid">
                      <div className="form-group">
                          <label className="form-label">Username (Locked)</label>
                          <input className="styled-input" value={user.username} disabled />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Full Name</label>
                          <input 
                            className="styled-input" 
                            value={isEditing ? editForm.full_name : user.full_name || ''} 
                            disabled={!isEditing}
                            onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                          />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Email</label>
                          <input 
                            className="styled-input" 
                            value={isEditing ? editForm.email : user.email || ''} 
                            disabled={!isEditing}
                            onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Phone</label>
                          <input 
                            className="styled-input" 
                            value={isEditing ? editForm.phone : user.phone || ''} 
                            disabled={!isEditing}
                            onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Gender</label>
                          <input 
                            className="styled-input" 
                            value={isEditing ? editForm.gender : user.gender || ''} 
                            disabled={!isEditing}
                            onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                          />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Age</label>
                          <input 
                            className="styled-input" 
                            value={isEditing ? editForm.age : user.age || ''} 
                            disabled={!isEditing}
                            onChange={(e) => setEditForm({...editForm, age: e.target.value})}
                          />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Favourite Animal</label>
                          <input 
                            className="styled-input" 
                            value={isEditing ? editForm.favourite_animal : user.favourite_animal || ''} 
                            disabled={!isEditing}
                            onChange={(e) => setEditForm({...editForm, favourite_animal: e.target.value})}
                          />
                      </div>
                      <div className="form-group">
                          <label className="form-label">Reason for Joining</label>
                          <input 
                            className="styled-input" 
                            value={isEditing ? editForm.reason : user.reason || ''} 
                            disabled={!isEditing}
                            onChange={(e) => setEditForm({...editForm, reason: e.target.value})}
                          />
                      </div>
                  </div>

                  {/* Avatar Selection when editing */}
                  {isEditing && (
                      <div style={{marginTop: '20px'}}>
                          <label className="form-label">CHANGE AVATAR</label>
                          <div style={{display:'flex', gap:'10px'}}>
                              {AVATARS.map(src => (
                                  <img 
                                    key={src} 
                                    src={src} 
                                    alt="avatar-opt"
                                    onClick={() => setEditForm({...editForm, avatar: src})}
                                    style={{
                                        width: '40px', height: '40px', 
                                        border: editForm.avatar === src ? '2px solid #222' : '1px solid #ddd',
                                        cursor: 'pointer', background: '#f9f9f9', imageRendering: 'pixelated'
                                    }}
                                  />
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          )}

          {/* 2. MY REPORTS TAB */}
          {activeTab === 'reports' && (
              <div>
                  <div className="form-label" style={{fontSize:'14px', marginBottom:'20px'}}>[ REPORT HISTORY ]</div>
                  {myReports.length === 0 && <div style={{color:'#999'}}>No reports submitted yet.</div>}
                  
                  {myReports.map(report => (
                      <div key={report.id} className="list-item" onClick={() => openReportModal(report)}>
                          <div>
                              <span className="item-status" style={{
                                  color: report.status === 'open' ? 'green' : '#555'
                              }}>{report.status}</span>
                              <div className="item-title">{report.title}</div>
                              <div className="item-date">Submitted: {formatDate(report.created_at)}</div>
                          </div>
                          <div style={{fontSize:'20px', color:'#ccc'}}>→</div>
                      </div>
                  ))}
              </div>
          )}

          {/* 3. MY BLOGS TAB */}
          {activeTab === 'blogs' && (
              <div>
                  <div className="form-label" style={{fontSize:'14px', marginBottom:'20px'}}>[ BLOG HISTORY ]</div>
                  {myBlogs.length === 0 && <div style={{color:'#999'}}>No blogs posted yet.</div>}

                  {myBlogs.map(blog => (
                      <div key={blog.id} className="list-item" onClick={() => setSelectedBlog(blog)}>
                          <div>
                              <div className="item-title">{blog.title}</div>
                              <div className="item-date">Posted: {formatDate(blog.created_at)}</div>
                              <div style={{fontSize:'10px', color:'#777', marginTop:'5px'}}>
                                  {blog.tags && blog.tags.join(', ')}
                              </div>
                          </div>
                          <div style={{fontSize:'20px', color:'#ccc'}}>→</div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* --- REPORT DETAILS MODAL --- */}
      {selectedReport && (
          <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                      <span>REPORT #{selectedReport.id.slice(0,6).toUpperCase()}</span>
                      <button onClick={() => setSelectedReport(null)} className="action-btn" style={{border:'none', padding:0}}>CLOSE [X]</button>
                  </div>
                  <div className="modal-body">
                      <div style={{marginBottom:'15px'}}>
                          <div style={{fontWeight:'bold', fontSize:'16px'}}>{selectedReport.title}</div>
                          <div style={{fontSize:'11px', color:'#666', marginTop:'5px'}}>
                              STATUS: {selectedReport.status} | SEVERITY: {selectedReport.severity}
                              <br/>LOC: {selectedReport.address || `${selectedReport.latitude}, ${selectedReport.longitude}`}
                          </div>
                      </div>
                      <div style={{fontSize:'12px', lineHeight:'1.5', marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
                          {selectedReport.description}
                      </div>
                      
                      {/* Media */}
                      {(selectedReport.photos?.length > 0 || selectedReport.videos?.length > 0) && (
                           <div style={{marginBottom:'20px'}}>
                               <div className="form-label">EVIDENCE</div>
                               <div style={{display:'flex', gap:'5px', overflowX:'auto'}}>
                                   {selectedReport.photos?.map((f,i) => <img key={i} src={`${API_URL}/uploads/${f}`} style={{height:'60px', border:'1px solid #ddd'}} />)}
                               </div>
                           </div>
                      )}

                      {/* Chat History */}
                      <div className="form-label">CHAT HISTORY</div>
                      {reportResponses.length === 0 && <div style={{color:'#999', fontSize:'11px'}}>No chats yet.</div>}
                      {reportResponses.map((r, i) => (
                          <div key={i} className="chat-bubble">
                              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'3px', fontSize:'10px', color:'#777'}}>
                                  <span>{r.volunteer_id === user?.id ? 'YOU' : 'RESCUER/USER'}</span>
                                  <span>{formatDate(r.created_at)}</span>
                              </div>
                              {r.message}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- BLOG DETAILS MODAL --- */}
      {selectedBlog && (
          <div className="modal-overlay" onClick={() => setSelectedBlog(null)}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                      <span>BLOG POST</span>
                      <button onClick={() => setSelectedBlog(null)} className="action-btn" style={{border:'none', padding:0}}>CLOSE [X]</button>
                  </div>
                  <div className="modal-body">
                      <div style={{fontWeight:'bold', fontSize:'18px', marginBottom:'10px'}}>{selectedBlog.title}</div>
                      <div style={{fontSize:'11px', color:'#999', marginBottom:'20px'}}>
                          {formatDate(selectedBlog.created_at)} | Tags: {selectedBlog.tags?.join(', ')}
                      </div>
                      <div style={{whiteSpace:'pre-wrap', fontSize:'12px', lineHeight:'1.6'}}>
                          {selectedBlog.content}
                      </div>
                      
                      {selectedBlog.photos?.length > 0 && (
                          <div style={{marginTop:'20px'}}>
                              {selectedBlog.photos.map((f, i) => (
                                  <img key={i} src={`${API_URL}/uploads/${f}`} style={{maxWidth:'100%', marginBottom:'10px', border:'1px solid #ddd'}} />
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}