// src/routes/reports.js
const express = require("express");
const db = require("../db");
const auth = require("../middleware/auth");

// robust require for upload helper (multer)
const uploadLib = require("../lib/upload");
const upload =
  (uploadLib && (uploadLib.upload || uploadLib.uploads || uploadLib)) ||
  null;

/**
 * Export router factory (accepts io and options)
 * module.exports = function(io, opts = {}) { ... }
 */
module.exports = function (io, opts = {}) {
  const { ngeohash, GEOHASH_PRECISION = 6 } = opts;
  const router = express.Router();

  // ------------------------------
  // Helper: Emit to Nearby Rooms
  // ------------------------------
  function emitToNearbyRooms(eventName, payload, lat, lng) {
    try {
      if (!ngeohash) {
        // fallback to global broadcast
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
      // fallback global
      io.emit(eventName, payload);
    }
  }

  // -------------------------------------------------
  // POST /   create report (supports multiple photos)
  // -------------------------------------------------
  // We use upload.any() so client can send many files named "photos" (or "photo")
  const uploadMiddleware = upload ? upload.any() : (req, res, next) => next();

  router.post("/", auth, uploadMiddleware, async (req, res) => {
    const {
      title,
      description,
      latitude,
      longitude,
      severity = null,
      category = null,
      location_text = null,
    } = req.body;

    // validate coordinates
    if (latitude == null || longitude == null) {
      return res
        .status(400)
        .json({ error: "latitude and longitude are required" });
    }

    // gather uploaded files -> array of paths
    // multer usually places files in req.files array
    let photos = [];
    try {
      if (Array.isArray(req.files) && req.files.length > 0) {
        // choose path or filename depending on storage config
        photos = req.files.map((f) => f.path || f.filename || f.location || null).filter(Boolean);
      } else if (req.file) {
        photos = [req.file.path || req.file.filename || null].filter(Boolean);
      }
    } catch (e) {
      console.error("file processing error:", e);
      photos = [];
    }

    try {
      // Insert into DB. Ensure your reports table has a photos TEXT[] column.
      // If DB driver can't accept JS arrays directly, you might need to use
      // PostgreSQL array literal or the driver's helper — this code assumes
      // your db.query accepts JS arrays for a TEXT[] column (pg/pg-promise usually does).
      const { rows } = await db.query(
        `INSERT INTO reports
         (reporter_id, title, description, latitude, longitude, severity, category, photo_url, location_text, photos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, reporter_id, title, description, latitude, longitude, severity, category, photo_url, location_text, photos, status, created_at`,
        [
          req.user.id,
          title || null,
          description || null,
          parseFloat(latitude),
          parseFloat(longitude),
          severity,
          category,
          // keep legacy single photo_url field null if not used
          photos.length > 0 ? (photos[0] || null) : null,
          location_text || null,
          photos, // photos array goes to photos column (TEXT[])
        ]
      );

      const report = rows[0];

      console.log("[REPORT CREATED] id=", report.id, "photos=", report.photos);

      // Emit new_report to nearby rooms (uses lat/lng)
      emitToNearbyRooms(
        "new_report",
        {
          id: report.id,
          title: report.title,
          description: report.description,
          latitude: report.latitude,
          longitude: report.longitude,
          severity: report.severity,
          category: report.category,
          photo_url: report.photo_url || null,
          photos: report.photos || [],
          location_text: report.location_text || null,
          status: report.status,
          created_at: report.created_at,
        },
        report.latitude,
        report.longitude
      );

      return res.status(201).json({ report });
    } catch (err) {
      console.error("create report error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // -------------------------------------------------
  // GET /nearby?lat=..&lng=..  -> return nearby reports
  // -------------------------------------------------
  // Simple bbox query - good enough for dev/testing.
  // If you have PostGIS you can replace with ST_DWithin queries.
  router.get("/nearby", async (req, res) => {
    const lat = parseFloat(req.query.lat || req.query.latitude || "0");
    const lng = parseFloat(req.query.lng || req.query.longitude || "0");
    const radiusKm = parseFloat(req.query.radiusKm || "5"); // default 5km

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng required" });
    }

    // crude degree approx (works near equator; good for dev)
    const degRadius = radiusKm / 111; // ~111 km per degree latitude

    const minLat = lat - degRadius;
    const maxLat = lat + degRadius;
    const minLng = lng - degRadius;
    const maxLng = lng + degRadius;

    try {
      const { rows } = await db.query(
        `SELECT id, reporter_id, title, description, latitude, longitude, severity, category, photo_url, photos, location_text, status, created_at
         FROM reports
         WHERE latitude BETWEEN $1 AND $2
           AND longitude BETWEEN $3 AND $4
         ORDER BY created_at DESC
         LIMIT 200`,
        [minLat, maxLat, minLng, maxLng]
      );

      return res.json({ reports: rows });
    } catch (err) {
      console.error("nearby query error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // -------------------------------------------------
  // POST /:id/respond  -> any authenticated user offers help
  // -------------------------------------------------
  router.post("/:id/respond", auth, async (req, res) => {
    const reportId = req.params.id;
    const { message } = req.body;

    try {
      const r = await db.query(
        "SELECT id, reporter_id, status, latitude, longitude FROM reports WHERE id = $1",
        [reportId]
      );
      if (!r.rows.length) return res.status(404).json({ error: "Report not found" });

      // optional: prevent reporter responding to own report
      if (r.rows[0].reporter_id === req.user.id) {
        return res.status(400).json({ error: "Reporter cannot respond to own report" });
      }

      const { rows } = await db.query(
        `INSERT INTO responses (report_id, volunteer_id, message, status)
         VALUES ($1,$2,$3,$4)
         RETURNING id, report_id, volunteer_id, message, status, created_at`,
        [reportId, req.user.id, message || null, "offered"]
      );

      const response = rows[0];
      const rpt = r.rows[0];

      emitToNearbyRooms("report_response", { reportId, response }, rpt.latitude, rpt.longitude);

      return res.status(201).json({ response });
    } catch (err) {
      console.error("respond error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // -------------------------------------------------
  // POST /:id/claim -> reporter accepts a volunteer
  // -------------------------------------------------
  router.post("/:id/claim", auth, async (req, res) => {
    const reportId = req.params.id;
    const { responseId } = req.body;

    try {
      const rep = await db.query(
        "SELECT id, reporter_id, status, latitude, longitude FROM reports WHERE id = $1",
        [reportId]
      );
      if (!rep.rows.length) return res.status(404).json({ error: "Report not found" });

      if (rep.rows[0].reporter_id !== req.user.id) {
        return res.status(403).json({ error: "Only reporter may claim" });
      }

      if (rep.rows[0].status !== "open") {
        return res.status(400).json({ error: "Report not open" });
      }

      await db.query("UPDATE responses SET status = $1 WHERE id = $2", ["accepted", responseId]);
      await db.query("UPDATE reports SET status = $1 WHERE id = $2", ["claimed", reportId]);

      const { rows } = await db.query("SELECT * FROM responses WHERE id = $1", [responseId]);
      const response = rows[0];

      const rpt = rep.rows[0];
      emitToNearbyRooms("report_claimed", { reportId, response }, rpt.latitude, rpt.longitude);

      return res.json({ ok: true, response });
    } catch (err) {
      console.error("claim error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // -------------------------------------------------
  // POST /:id/status -> update report/response status (arrived/resolved/closed)
  // -------------------------------------------------
  router.post("/:id/status", auth, async (req, res) => {
    const reportId = req.params.id;
    const { status, responseId } = req.body;

    try {
      const rep = await db.query("SELECT id, latitude, longitude FROM reports WHERE id = $1", [reportId]);
      if (!rep.rows.length) return res.status(404).json({ error: "Report not found" });

      if (status) {
        await db.query("UPDATE reports SET status = $1 WHERE id = $2", [status, reportId]);

        if (responseId) {
          await db.query("UPDATE responses SET status = $1 WHERE id = $2", [status, responseId]);
        }

        const rpt = rep.rows[0];
        emitToNearbyRooms("report_status", { reportId, status, responseId }, rpt.latitude, rpt.longitude);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("status update error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  });

  // return the configured router
  return router;
};
