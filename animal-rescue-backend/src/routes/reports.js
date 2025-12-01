// src/routes/reports.js
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

module.exports = function (io, opts = {}) {
  const { ngeohash, GEOHASH_PRECISION = 6 } = opts;
  const router = express.Router();

  function emitToNearbyRooms(eventName, payload, lat, lng) {
    try {
      if (!ngeohash) {
        // fallback to global broadcast
        io.emit(eventName, payload);
        return;
      }
      const gh = ngeohash.encode(lat, lng, GEOHASH_PRECISION);
      const neighbors = ngeohash.neighbors(gh) || [];
      // include own geohash + neighbors
      const rooms = [gh, ...neighbors];
      // emit to each room
      rooms.forEach((room) => {
        try {
          io.to(room).emit(eventName, payload);
        } catch (e) {
          console.error('emitToNearbyRooms emit error', e);
        }
      });
    } catch (e) {
      console.error('emitToNearbyRooms error', e);
      // fallback
      io.emit(eventName, payload);
    }
  }

  // Create a report (auth required) and emit to nearby rooms
  router.post('/', auth, async (req, res) => {
    const {
      title,
      description,
      latitude,
      longitude,
      severity = null,
      category = null,
      photo_url = null,
      location_text = null
    } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    try {
      const { rows } = await db.query(
        `INSERT INTO reports
         (reporter_id, title, description, latitude, longitude, severity, category, photo_url, location_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, reporter_id, title, description, latitude, longitude, severity, category, photo_url, location_text, status, created_at`,
        [req.user.id, title, description, latitude, longitude, severity, category, photo_url, location_text]
      );
      const report = rows[0];

      console.log('[REPORT CREATED] id=', report.id, 'title=', report.title);
      // Emit only to nearby geohash rooms (includes neighbors)
      emitToNearbyRooms('new_report', {
        id: report.id,
        title: report.title,
        description: report.description,
        latitude: report.latitude,
        longitude: report.longitude,
        severity: report.severity,
        category: report.category,
        photo_url: report.photo_url,
        location_text: report.location_text,
        created_at: report.created_at,
      }, report.latitude, report.longitude);

      return res.status(201).json({ report });
    } catch (err) {
      console.error('create report error', err);
      return res.status(500).json({ error: 'Database error' });
    }
  });

  // existing endpoints unchanged except response emits use emitToNearbyRooms

  // Offer help (any authenticated user)
  router.post('/:id/respond', auth, async (req, res) => {
    const reportId = req.params.id;
    const { message } = req.body;
    try {
      const r = await db.query('SELECT id, status, reporter_id, latitude, longitude FROM reports WHERE id = $1', [reportId]);
      if (!r.rows.length) return res.status(404).json({ error: 'Report not found' });

      // optional: prevent reporter from responding to their own report
      if (r.rows[0].reporter_id === req.user.id) {
        return res.status(400).json({ error: 'Reporter cannot respond to their own report' });
      }

      const { rows } = await db.query(
        `INSERT INTO responses (report_id, volunteer_id, message, status)
         VALUES ($1,$2,$3,$4) RETURNING id, report_id, volunteer_id, message, status, created_at`,
        [reportId, req.user.id, message || null, 'offered']
      );
      const response = rows[0];

      // emit to nearby rooms around the report location (so reporter & nearby clients get notified)
      const rpt = r.rows[0];
      emitToNearbyRooms('report_response', { reportId, response }, rpt.latitude, rpt.longitude);

      return res.status(201).json({ response });
    } catch (err) {
      console.error('respond error', err);
      return res.status(500).json({ error: 'Database error' });
    }
  });

  // Reporter accepts a volunteer (claim)
  router.post('/:id/claim', auth, async (req, res) => {
    const reportId = req.params.id;
    const { responseId } = req.body;
    try {
      const rep = await db.query('SELECT id, reporter_id, status, latitude, longitude FROM reports WHERE id = $1', [reportId]);
      if (!rep.rows.length) return res.status(404).json({ error: 'Report not found' });
      if (rep.rows[0].reporter_id !== req.user.id) {
        return res.status(403).json({ error: 'Only reporter may claim' });
      }
      if (rep.rows[0].status !== 'open') {
        return res.status(400).json({ error: 'Report not open' });
      }

      await db.query('UPDATE responses SET status = $1 WHERE id = $2', ['accepted', responseId]);
      await db.query('UPDATE reports SET status = $1 WHERE id = $2', ['claimed', reportId]);

      const { rows } = await db.query('SELECT * FROM responses WHERE id = $1', [responseId]);
      const response = rows[0];

      const rpt = rep.rows[0];
      emitToNearbyRooms('report_claimed', { reportId, response }, rpt.latitude, rpt.longitude);

      return res.json({ ok: true, response });
    } catch (err) {
      console.error('claim error', err);
      return res.status(500).json({ error: 'Database error' });
    }
  });

  // Update response/report status (arrived / resolved)
  router.post('/:id/status', auth, async (req, res) => {
    const reportId = req.params.id;
    const { status, responseId } = req.body; // status: arrived/resolved/closed
    try {
      const rep = await db.query('SELECT id, latitude, longitude FROM reports WHERE id = $1', [reportId]);
      if (!rep.rows.length) return res.status(404).json({ error: 'Report not found' });

      if (status) {
        await db.query('UPDATE reports SET status = $1 WHERE id = $2', [status, reportId]);
        if (responseId) {
          await db.query('UPDATE responses SET status = $1 WHERE id = $2', [status, responseId]);
        }
        const rpt = rep.rows[0];
        emitToNearbyRooms('report_status', { reportId, status, responseId }, rpt.latitude, rpt.longitude);
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('status update error', err);
      return res.status(500).json({ error: 'Database error' });
    }
  });

  // other endpoints remain unchanged...

  return router;
};
