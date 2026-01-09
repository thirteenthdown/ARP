// src/routes/blogs.js
const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

// Robust require for upload helper (multer)
const uploadLib = require("../lib/upload");
const upload =
  (uploadLib && (uploadLib.upload || uploadLib.uploads || uploadLib)) ||
  null;

module.exports = function (io) {
  const router = express.Router();

  // -------------------------------------------------
  // POST /   -> Create a new blog post
  // -------------------------------------------------
  // Allows uploading multiple files with field name "media" (or "photos"/"videos")
  const uploadMiddleware = upload ? upload.any() : (req, res, next) => next();

  router.post("/", auth, uploadMiddleware, async (req, res) => {
    const { title, content, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required." });
    }

    // Process Tags: "tag1, tag2" -> ["tag1", "tag2"]
    let tagsArray = [];
    if (tags) {
      tagsArray = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim()).filter(Boolean);
    }

    // Process Files: Separate Images and Videos
    let photos = [];
    let videos = [];

    try {
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          const filename = file.filename; // Only store filename, frontend appends URL
          if (file.mimetype.startsWith("image/")) {
            photos.push(filename);
          } else if (file.mimetype.startsWith("video/")) {
            videos.push(filename);
          }
        });
      }
    } catch (e) {
      console.error("File processing error:", e);
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO blogs 
         (author_id, title, content, tags, photos, videos)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, author_id, title, content, tags, photos, videos, created_at`,
        [
          req.user.id,
          title,
          content,
          tagsArray,
          photos,
          videos,
        ]
      );

      const newBlog = rows[0];

      // Fetch author name to return complete object
      const userRes = await db.query("SELECT username FROM users WHERE id = $1", [req.user.id]);
      newBlog.author = userRes.rows[0]?.username || "Unknown";

      // Optional: Emit socket event for real-time updates
      if (io) {
        io.emit("new_blog", newBlog);
      }

      return res.status(201).json({ blog: newBlog });
    } catch (err) {
      console.error("Create blog error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // -------------------------------------------------
  // GET /   -> Get all blogs (Feed)
  // -------------------------------------------------
  router.get("/", async (req, res) => {
    try {
      // Join with users table to get author name
      const { rows } = await db.query(
        `SELECT b.*, u.username as author 
         FROM blogs b
         JOIN users u ON b.author_id = u.id
         ORDER BY b.created_at DESC
         LIMIT 50`
      );

      return res.json({ blogs: rows });
    } catch (err) {
      console.error("Fetch blogs error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

// GET /blogs/mine - Get blogs written by current user
  router.get("/mine", auth, async (req, res) => {
    try {
      // We can also join with users if we want author name, though it's the current user
      const { rows } = await db.query(
        `SELECT * FROM blogs 
         WHERE author_id = $1 
         ORDER BY created_at DESC`,
        [req.user.id]
      );
      res.json({ blogs: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  return router;
};