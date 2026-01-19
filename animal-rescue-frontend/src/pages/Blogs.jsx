// src/pages/Blogs.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../lib/api"; 

/**
 * Blogs Page
 * Connected to Backend API
 */

// Helper to format date
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

// !!! IMPORTANT: MATCH THIS PORT TO YOUR BACKEND (3000) !!!
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"; 

export default function Blogs({ onLogout }) {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState(null);

  // State for the Feed
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for Modal
  const [showModal, setShowModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", tags: "", media: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load User ID & Fetch Blogs
  useEffect(() => {
    const t = localStorage.getItem("token");
    const uid = t ? getUserIdFromToken(t) : null;
    setCurrentUserId(uid);

    fetchBlogs();
  }, []);

  async function fetchBlogs() {
    try {
      setLoading(true);
      const res = await api.get("/blogs");
      setBlogs(res.data.blogs || []);
    } catch (err) {
      console.error("Failed to fetch blogs:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPost(prev => ({ ...prev, [name]: value }));
  };

  const handleMediaSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArr = Array.from(e.target.files);
      setNewPost(prev => ({ ...prev, media: [...prev.media, ...filesArr] }));
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const fd = new FormData();
    fd.append("title", newPost.title);
    fd.append("content", newPost.content);
    fd.append("tags", newPost.tags);

    newPost.media.forEach((file) => {
      fd.append("media", file); 
    });

    try {
      const res = await api.post("/blogs", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      const publishedBlog = res.data.blog;
      
      setBlogs(prev => [publishedBlog, ...prev]);
      setShowModal(false);
      setNewPost({ title: "", content: "", tags: "", media: [] }); 
      alert("Blog published successfully!");

    } catch (err) {
      console.error("Publish failed:", err);
      alert(err.response?.data?.error || "Failed to publish blog.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        
        .top-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
            margin-bottom: 25px;
        }
        .nav-links { display: flex; gap: 20px; }
        .nav-link-item {
            font-size: 11px;
            font-weight: 500;
            color: #777;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: color 0.2s;
        }
        .nav-link-item:hover { color: #000; }
        .nav-link-item.active {
            font-weight: 700;
            color: #000;
            border-bottom: 2px solid #000;
            padding-bottom: 2px;
        }
        .nav-right { display: flex; align-items: center; gap: 15px; }
        .nav-user-id {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            font-size: 11px;
            color: #222;
        }
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
        .logout-btn-nav:hover { background: #d32f2f; color: #fff; }

        .home-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .home-header h1 {
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

        .feed-wrapper {
            width: 60%;
            min-width: 320px;
            max-width: 600px;
            margin: 0 auto; 
        }

        .write-blog-trigger {
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 25px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        }
        .write-blog-trigger:hover {
            background: #f9f9f9;
            border-color: #999;
        }
        .trigger-text {
            font-size: 11px;
            font-weight: 600;
            color: #777;
            text-transform: uppercase;
        }

        .blog-card {
            border: 1px solid #ddd;
            padding: 15px;
            margin-bottom: 15px;
            background: #fff;
        }
        .blog-header-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
        }
        .blog-author {
            font-weight: bold;
            font-size: 11px;
            color: #222;
            text-transform: uppercase;
        }
        .blog-date {
            font-size: 10px;
            color: #999;
        }
        .blog-title {
            font-size: 14px; 
            font-weight: bold;
            margin-bottom: 8px;
            color: #000;
        }
        .blog-content {
            font-size: 11px;
            line-height: 1.5;
            margin-bottom: 10px;
            color: #444;
            white-space: pre-wrap;
        }
        .blog-tags {
            font-size: 10px;
            color: #d32f2f;
            margin-bottom: 10px;
            font-weight: 600;
        }
        .blog-media-grid {
            margin-top: 10px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        .blog-img {
            max-width: 100%;
            border: 1px solid #ddd;
            display: block;
        }

        .modal-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
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
            max-width: 500px;
            border: 2px solid #222;
            display: flex;
            flex-direction: column;
            box-shadow: 10px 10px 0px rgba(0,0,0,0.1);
            max-height: 80vh;
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
        
        .styled-input, .styled-textarea {
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
        .styled-input:focus, .styled-textarea:focus { border-color: #333; }
        
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
        .action-btn:hover { background-color: #f9f9f9; border-color: #999; color: #222; }
        .action-btn.primary { border-color: #4a4a4a; color: #222; }
        .form-label {
            display: block; font-size: 10px; font-weight: bold; margin-bottom: 5px; color: #222;
        }
      `}</style>

      {/* --- TOP NAV BAR --- */}
      <div className="top-nav">
          <div className="nav-links">
              <span className="nav-link-item" onClick={() => navigate("/")}>RESCUE</span>
              <span className="nav-link-item active" onClick={() => navigate("/blogs")}>BLOGS</span>
              <span className="nav-link-item" onClick={() => navigate("/profile")}>MY PROFILE</span>
          </div>

          <div className="nav-right">
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
      </div>

      {/* --- HEADER --- */}
      <header className="home-header">
        <h1>
          Blogs <span className="chinese">[博 客]</span>
        </h1>
        <div className="section-mark-header">[1]</div>
      </header>

      {/* --- CONTENT AREA (3/5th Width, Centered) --- */}
      <div className="feed-wrapper">
        
        {/* Write Trigger */}
        <div className="write-blog-trigger" onClick={() => setShowModal(true)}>
            <span className="trigger-text">Write a new blog...</span>
            <span style={{fontSize: '14px', fontWeight: 'bold'}}>[ + ]</span>
        </div>

        {/* Loading State */}
        {loading && <div style={{textAlign:'center', color:'#999', margin:'20px 0'}}>LOADING BLOGS...</div>}

        {/* Empty State */}
        {!loading && blogs.length === 0 && (
            <div style={{textAlign:'center', color:'#999', margin:'20px 0'}}>NO BLOGS YET. BE THE FIRST!</div>
        )}

        {/* Feed */}
        {blogs.map((blog) => (
            <div key={blog.id} className="blog-card">
                <div className="blog-header-row">
                    <span className="blog-author">
                        {blog.author ? blog.author : `USER ID: ${blog.author_id ? blog.author_id.slice(0,6) : '...'}`}
                    </span>
                    <span className="blog-date">{formatDate(blog.created_at)}</span>
                </div>
                
                <div className="blog-title">{blog.title}</div>
                <div className="blog-content">{blog.content}</div>

                {blog.tags && blog.tags.length > 0 && (
                    <div className="blog-tags">
                        {blog.tags.map((t, i) => (
                            <span key={i} style={{marginRight: '8px'}}>{t}</span>
                        ))}
                    </div>
                )}

                {/* Display Photos */}
                {blog.photos && blog.photos.length > 0 && (
                    <div className="blog-media-grid">
                        {blog.photos.map((filename, idx) => (
                            <img 
                                key={idx} 
                                src={`${API_BASE_URL}/uploads/${filename}`} 
                                className="blog-img" 
                                alt="Blog attachment" 
                            />
                        ))}
                    </div>
                )}
                
                {/* Display Videos (If any) */}
                {blog.videos && blog.videos.length > 0 && (
                    <div className="blog-media-grid">
                        {blog.videos.map((filename, idx) => (
                            <video 
                                key={idx} 
                                src={`${API_BASE_URL}/uploads/${filename}`} 
                                className="blog-img" 
                                controls
                            />
                        ))}
                    </div>
                )}
            </div>
        ))}
      </div>

      {/* --- CREATE MODAL --- */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span style={{fontWeight: 'bold'}}>COMPOSE BLOG</span>
                    <button onClick={() => setShowModal(false)} className="action-btn">CLOSE [X]</button>
                </div>
                
                <div className="modal-content-scroll">
                    <form id="blogForm" onSubmit={handlePublish}>
                        <div>
                            <label className="form-label">TITLE</label>
                            <input 
                                className="styled-input"
                                name="title"
                                value={newPost.title}
                                onChange={handleInputChange}
                                placeholder="Enter title..."
                                required
                            />
                        </div>

                        <div>
                            <label className="form-label">CONTENT</label>
                            <textarea 
                                className="styled-textarea"
                                name="content"
                                rows={6}
                                value={newPost.content}
                                onChange={handleInputChange}
                                placeholder="Start writing..."
                                required
                            />
                        </div>

                        <div style={{marginBottom: '10px'}}>
                            <label className="form-label">MEDIA</label>
                            <div style={{display:'flex', gap:'10px'}}>
                                <label className="action-btn" style={{flex:1, textAlign:'center'}}>
                                    ADD PHOTO
                                    <input type="file" accept="image/*" multiple hidden onChange={handleMediaSelect} />
                                </label>
                                <label className="action-btn" style={{flex:1, textAlign:'center'}}>
                                    ADD VIDEO
                                    <input type="file" accept="video/*" multiple hidden onChange={handleMediaSelect} />
                                </label>
                            </div>
                            {newPost.media.length > 0 && (
                                <div style={{fontSize:'9px', color:'green', marginTop:'5px'}}>
                                    {newPost.media.length} FILE(S) SELECTED
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="form-label">TAGS (COMMA SEPARATED)</label>
                            <input 
                                className="styled-input"
                                name="tags"
                                value={newPost.tags}
                                onChange={handleInputChange}
                                placeholder="#rescue, #help..."
                            />
                        </div>
                    </form>
                </div>

                <div style={{padding: '15px', borderTop: '1px solid #ddd', background: '#fafafa', display: 'flex', justifyContent: 'flex-end'}}>
                    <button 
                        type="submit" 
                        form="blogForm" 
                        className="action-btn primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "PUBLISHING..." : "PUBLISH BLOG"}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}