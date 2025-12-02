import React, { useState } from "react";
import MapView from "../components/MapView";
import api from "../lib/api";

export default function Home({ onLogout }) {
  const [reportMode, setReportMode] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submitReport(e) {
    e.preventDefault();

    if (!selectedLocation) {
      alert("Please tap on the map to choose a location.");
      return;
    }
    if (!title) {
      alert("Please enter a title.");
      return;
    }

    try {
      setLoading(true);
      // POST /reports expects: title, description, latitude, longitude, severity, category (optional)
      const res = await api.post("/reports", {
        title,
        description,
        severity: parseInt(severity, 10),
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        category: "general",
      });

      console.log("Report created:", res.data);
      alert("Report submitted successfully!");

      // reset form
      setReportMode(false);
      setTitle("");
      setDescription("");
      setSeverity(1);
      setSelectedLocation(null);
    } catch (err) {
      console.error("Submit report failed:", err);
      alert("Failed to submit report. See console for details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      {/* Map area on top */}
      <div className="w-full" style={{ height: "65vh" }}>
        <MapView
          reportMode={reportMode}
          onSelectLocation={(loc) => {
            // loc is a Leaflet LatLng object or {lat, lng}
            const normalized = loc && loc.lat !== undefined ? loc : { lat: loc.lat, lng: loc.lng };
            console.log("Got location from map:", normalized);
            setSelectedLocation(normalized);
            // Optionally keep reportMode true so user can confirm form; we keep it true until submit or cancel
          }}
        />
      </div>

      {/* Controls area */}
      <div className="p-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Animal Rescue</h2>

            <div className="space-x-2">
              <button
                onClick={() => {
                  setReportMode((s) => !s);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                {reportMode ? "Cancel" : "Report Animal"}
              </button>

              <button
                onClick={() => {
                  if (onLogout) onLogout();
                }}
                className="bg-red-600 text-white px-3 py-2 rounded"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Form area (visible when reportMode true) */}
          {reportMode && (
            <div className="mt-4 bg-gray-50 p-4 rounded shadow">
              <form onSubmit={submitReport} className="space-y-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />

                <textarea
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={3}
                />

                <div className="flex gap-3">
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="p-2 border rounded"
                  >
                    <option value="1">Low Severity</option>
                    <option value="2">Medium Severity</option>
                    <option value="3">High Severity</option>
                  </select>

                  <div className="flex-1 text-sm text-gray-700 flex items-center">
                    {selectedLocation ? (
                      <span>
                        Selected: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                      </span>
                    ) : (
                      <span className="text-red-500">Tap map to choose location</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60"
                  >
                    {loading ? "Submitting..." : "Submit Report"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReportMode(false);
                    }}
                    className="bg-gray-300 px-4 py-2 rounded"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
