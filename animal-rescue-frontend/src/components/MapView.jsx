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

// Fix Leaflet icon paths (works with CDN images)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom red pin icon
const redPin = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Map click handler component (must be a component so hooks are valid)
function MapClickHandler({ enabled, onSelect }) {
  useMapEvents({
    click(e) {
      if (enabled && onSelect) {
        // e.latlng is a Leaflet LatLng object
        onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

export default function MapView({
  reportMode,
  onSelectLocation,
  selectedLocation,
}) {
  const [pos, setPos] = useState(null);
  const [reports, setReports] = useState([]);

  // get location (with fallback)
  useEffect(() => {
    const fallback = { lat: 18.5204, lng: 73.8567 }; // Pune fallback

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (loc) => {
          const coords = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          };
          setPos(coords);

          const s = getSocket();
          if (s && s.emit) s.emit("set_location", coords);
        },
        (err) => {
          console.warn("Geolocation failed, using fallback:", err);
          setPos(fallback);
          const s = getSocket();
          if (s && s.emit) s.emit("set_location", fallback);
        },
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 0 }
      );
    } else {
      // non-browser environment or no geolocation
      setPos(fallback);
    }
  }, []);

  // fetch nearby reports after we have pos
  useEffect(() => {
    if (!pos) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(
          `/reports/nearby?lat=${pos.lat}&lng=${pos.lng}`
        );
        if (!cancelled) {
          setReports(res.data.reports || []);
        }
      } catch (err) {
        // show a console warning but continue gracefully
        console.warn(
          "Nearby API failed:",
          err?.response?.status || err.message
        );
        setReports([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pos]);

  // subscribe to socket events
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    function onNewReport(data) {
      // append incoming report to list
      setReports((prev) => {
        // avoid duplicates
        if (prev.find((r) => r.id === data.id)) return prev;
        return [...prev, data];
      });
    }

    s.on("new_report", onNewReport);
    s.on("report_response", (d) => console.log("report_response", d));
    s.on("report_claimed", (d) => console.log("report_claimed", d));

    return () => {
      s.off("new_report", onNewReport);
    };
  }, []);

  if (!pos) {
    return <div className="p-4">Fetching location...</div>;
  }

  return (
    <MapContainer
      center={[pos.lat, pos.lng]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* enable map clicks only when reportMode is active */}
      <MapClickHandler enabled={reportMode} onSelect={onSelectLocation} />

      {/* user marker */}
      <Marker position={[pos.lat, pos.lng]}>
        <Popup>You are here</Popup>
      </Marker>
      {selectedLocation && (
        <Marker position={selectedLocation} icon={redPin}>
          <Popup>Selected Location</Popup>
        </Marker>
      )}

      {/* existing reports */}
      {reports.map((r) => (
        <Marker key={r.id} position={[r.latitude, r.longitude]}>
          <Popup>
            <strong>{r.title}</strong>
            <div className="text-sm">{r.description}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
