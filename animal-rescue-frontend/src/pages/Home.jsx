import React, { useState } from "react";
import MapView from "../components/MapView";
const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [severity, setSeverity] = useState(1);
const [selectedLocation, setSelectedLocation] = useState(null);
const [loading, setLoading] = useState(false);


export default function Home() {
  const [reportMode, setReportMode] = useState(false);

  return (
    <div className="relative h-[70vh] w-full" style={{ height: "65vh" }}>
      {/* Map */}
      <MapView
  reportMode={reportMode}
  onSelectLocation={(loc) => {
    console.log("Got location:", loc);
    setSelectedLocation(loc);
  }}
/>

      {/* Report Animal Button */}
      {!reportMode && (
        <button
          onClick={() => setReportMode(true)}
          className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-full shadow-xl font-medium"
        >
          Report Animal
        </button>
      )}

      {/* Cancel Button */}
      {reportMode && (
        <button
          onClick={() => setReportMode(false)}
          className="fixed bottom-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-full shadow-xl font-medium"
        >
          Cancel
        </button>
      )}
      {/* Report Form */}
{reportMode && (
  <div className="fixed bottom-20 left-0 w-full bg-white shadow-xl p-5 rounded-t-2xl">
    <h2 className="text-xl font-semibold mb-3">Report an Animal</h2>

    <form className="space-y-3" onSubmit={submitReport}>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full p-3 border rounded"
        required
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full p-3 border rounded"
        required
      />

      <select
        value={severity}
        onChange={(e) => setSeverity(e.target.value)}
        className="w-full p-3 border rounded"
      >
        <option value="1">Low Severity</option>
        <option value="2">Medium Severity</option>
        <option value="3">High Severity</option>
      </select>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white p-3 rounded disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Report"}
      </button>
    </form>

    {!selectedLocation && (
      <p className="text-red-500 mt-2 text-sm">
        Tap on the map to select the location.
      </p>
    )}
  </div>
)}


    </div>
  );
}

async function submitReport(e) {
  e.preventDefault();
  if (!selectedLocation) {
    alert("Please tap on the map to choose a location.");
    return;
  }

  try {
    setLoading(true);

    const res = await api.post("/reports", {
      title,
      description,
      severity: parseInt(severity),
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      category: "general"
    });

    console.log("Report created:", res.data);

    // Reset form
    setReportMode(false);
    setTitle("");
    setDescription("");
    setSeverity(1);
    setSelectedLocation(null);

    alert("Report submitted successfully!");

  } catch (err) {
    console.error(err);
    alert("Failed to submit report.");
  } finally {
    setLoading(false);
  }
}

