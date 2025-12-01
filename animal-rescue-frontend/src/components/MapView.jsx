import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import api from "../lib/api";
import { getSocket } from "../lib/socket";

// Fix default marker icons for Leaflet
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Separate click handler component
function MapClickHandler({ reportMode, onSelect }) {
  useMapEvents({
    click(e) {
      if (reportMode) {
        console.log("Map clicked:", e.latlng);
        onSelect(e.latlng);
      }
    },
  });
  return null;
}

export default function MapView({ reportMode, onSelectLocation }) {
  const [pos, setPos] = useState(null);
  const [reports, setReports] = useState([]);

  // Ask browser for location
  useEffect(() => {
    const fallback = { lat: 18.5204, lng: 73.8567 }; // Pune

    navigator.geolocation.getCurrentPosition(
      (loc) => {
        const coords = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        };
        setPos(coords);

        const s = getSocket();
        if (s) s.emit("set_location", coords);
      },
      (err) => {
        console.error("Location error:", err);
        setPos(fallback);

        const s = getSocket();
        if (s) s.emit("set_location", fallback);
      },
      { enableHighAccuracy: false, timeout: 4000 }
    );
  }, []);

  // Fetch nearby reports
  useEffect(() => {
    async function load() {
      try {
        // use current position when available
        const lat = pos?.lat || 18.5204;
        const lng = pos?.lng || 73.8567;

        const res = await api.get(`/reports/nearby?lat=${lat}&lng=${lng}`);
        setReports(res.data.reports || []);
      } catch (err) {
        console.error("Nearby API failed:", err);
      }
    }

    load();
  }, [pos]);

  if (!pos) return <p className="p-4">Fetching location...</p>;

  return (
    <MapContainer
      center={pos}
      zoom={15}
style={{ height: "65vh", width: "100%", zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Click handler for report mode */}
      <MapClickHandler
        reportMode={reportMode}
        onSelect={(latlng) => {
          console.log("Selected location:", latlng);
          onSelectLocation(latlng);
        }}
      />

      {/* User location marker */}
      {pos && (
        <Marker position={pos}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {/* Nearby reports */}
      {reports.map((r) => (
        <Marker key={r.id} position={{ lat: r.latitude, lng: r.longitude }}>
          <Popup>
            <strong>{r.title}</strong>
            <br />
            {r.description}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
