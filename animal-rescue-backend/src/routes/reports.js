// src/routes/reports.js
const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

const uploadLib = require("../lib/upload");
const upload =
  (uploadLib && (uploadLib.upload || uploadLib.uploads || uploadLib)) ||
  null;

module.exports = function (io, opts = {}) {
  const { ngeohash, GEOHASH_PRECISION = 6 } = opts;
  const router = express.Router();

  function emitToNearbyRooms(eventName, payload, lat, lng) {
    try {
      if (!ngeohash) {
        io.emit(eventName, payload);
        return;
      }
      const gh = ngeohash.encode(lat, lng, GEOHASH_PRECISION);
      const neighbors = ngeohash.neighbors(gh) || [];
      const rooms = [gh, ...neighbors];

      rooms.forEach((room) => {
        try {
          io.to(room).emit(eventName, payload);
        } catch (e) {
          console.error("emit error:", e);
        }
      });
    } catch (e) {
      console.error("emitToNearbyRooms error:", e);
      io.emit(eventName, payload);
    }
  }

  const uploadMiddleware = upload ? upload.any() : (req, res, next) => next();

  // POST / - Create Report
  router.post("/", auth, uploadMiddleware, async (req, res) => {
    const {
      title,
      description,
      latitude,
      longitude,
      severity = null,
      animal_type = null,
      address = null,
    } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }

    let photos = [];
    let videos = [];

    try {
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          const filename = file.filename;
          if (file.mimetype.startsWith("image/")) {
            photos.push(filename);
          } else if (file.mimetype.startsWith("video/")) {
            videos.push(filename);
          }
        });
      }
    } catch (e) {
      console.error("file processing error:", e);
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO reports
         (reporter_id, title, description, latitude, longitude, severity, animal_type, address, photos, videos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          req.user.id,
          title || "Untitled",
          description || "",
          parseFloat(latitude),
          parseFloat(longitude),
          severity,
          animal_type,
          address,
          photos,
          videos,
        ]
      );

      const report = rows[0];
      console.log("[REPORT CREATED]", report.id);

      emitToNearbyRooms(
        "new_report",
        report,
        report.latitude,
        report.longitude
      );

      return res.status(201).json({ report });
    } catch (err) {
      console.error("create report error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // GET /nearby
  router.get("/nearby", async (req, res) => {
    const lat = parseFloat(req.query.lat || "0");
    const lng = parseFloat(req.query.lng || "0");
    const radiusKm = parseFloat(req.query.radiusKm || "5");
    const isGlobal = req.query.global === "true";

    try {
      let query = "";
      let params = [];

      if (isGlobal) {
        query = `SELECT * FROM reports ORDER BY created_at DESC LIMIT 200`;
        params = [];
      } else {
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          return res.status(400).json({ error: "lat and lng required" });
        }
        const degRadius = radiusKm / 111;
        const minLat = lat - degRadius;
        const maxLat = lat + degRadius;
        const minLng = lng - degRadius;
        const maxLng = lng + degRadius;

        query = `SELECT *
                 FROM reports
                 WHERE latitude BETWEEN $1 AND $2
                   AND longitude BETWEEN $3 AND $4
                 ORDER BY created_at DESC
                 LIMIT 200`;
        params = [minLat, maxLat, minLng, maxLng];
      }

      const { rows } = await db.query(query, params);
      return res.json({ reports: rows });
    } catch (err) {
      console.error("nearby query error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // -----------------------------------------------------------
  // NEW ROUTE: Get Chat History for a Report
  // -----------------------------------------------------------
  router.get("/:id/responses", auth, async (req, res) => {
    const reportId = req.params.id;
    try {
      // Fetch all messages for this report, ordered by time
      const { rows } = await db.query(
        `SELECT * FROM responses 
         WHERE report_id = $1 
         ORDER BY created_at ASC`,
        [reportId]
      );
      return res.json({ responses: rows });
    } catch (err) {
      console.error("fetch responses error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // POST /:id/respond
  router.post("/:id/respond", auth, async (req, res) => {
    const reportId = req.params.id;
    const { message } = req.body;
    try {
      const r = await db.query("SELECT id, latitude, longitude FROM reports WHERE id = $1", [reportId]);
      if (!r.rows.length) return res.status(404).json({ error: "Report not found" });

      const { rows } = await db.query(
        `INSERT INTO responses (report_id, volunteer_id, message, status)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [reportId, req.user.id, message || null, "offered"]
      );
      const response = rows[0];
      const rpt = r.rows[0];
      emitToNearbyRooms("report_response", { reportId, response }, rpt.latitude, rpt.longitude);
      return res.status(201).json({ response });
    } catch (err) {
      return res.status(500).json({ error: "Database error" });
    }
  });

  // POST /:id/claim
  router.post("/:id/claim", auth, async (req, res) => {
    const reportId = req.params.id;
    const { responseId } = req.body;
    try {
      const rep = await db.query("SELECT * FROM reports WHERE id = $1", [reportId]);
      if (!rep.rows.length) return res.status(404).json({ error: "Report not found" });
      if (rep.rows[0].reporter_id !== req.user.id) return res.status(403).json({ error: "Only reporter may claim" });
      if (rep.rows[0].status !== "open") return res.status(400).json({ error: "Report not open" });

      await db.query("UPDATE responses SET status = $1 WHERE id = $2", ["accepted", responseId]);
      await db.query("UPDATE reports SET status = $1 WHERE id = $2", ["claimed", reportId]);
      const { rows } = await db.query("SELECT * FROM responses WHERE id = $1", [responseId]);
      const response = rows[0];
      const rpt = rep.rows[0];
      emitToNearbyRooms("report_claimed", { reportId, response }, rpt.latitude, rpt.longitude);
      return res.json({ ok: true, response });
    } catch (err) {
      return res.status(500).json({ error: "Database error" });
    }
  });

  // POST /:id/status
  router.post("/:id/status", auth, async (req, res) => {
    const reportId = req.params.id;
    const { status, responseId } = req.body;
    try {
      const rep = await db.query("SELECT id, latitude, longitude FROM reports WHERE id = $1", [reportId]);
      if (!rep.rows.length) return res.status(404).json({ error: "Report not found" });
      if (status) {
        await db.query("UPDATE reports SET status = $1 WHERE id = $2", [status, reportId]);
        if (responseId) await db.query("UPDATE responses SET status = $1 WHERE id = $2", [status, responseId]);
        const rpt = rep.rows[0];
        emitToNearbyRooms("report_status", { reportId, status, responseId }, rpt.latitude, rpt.longitude);
      }
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "Database error" });
    }
  });

  // GET /reports/mine - Get reports submitted by current user
  router.get("/mine", auth, async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT * FROM reports 
         WHERE reporter_id = $1 
         ORDER BY created_at DESC`,
        [req.user.id]
      );
      res.json({ reports: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  return router;
};