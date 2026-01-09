// src/components/MapView.jsx
import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

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

// Custom red pin icon (For User Reports)
const redPin = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Custom GREEN pin icon (For User Location 'You are here')
const greenPin = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map click handler component
function MapClickHandler({ enabled, onSelect }) {
  useMapEvents({
    click(e) {
      if (enabled && onSelect) {
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
  reports = [],     
  userLocation,    
  onViewReport,  // Receive function from parent
}) {
  
  if (!userLocation) {
    return <div className="p-4" style={{padding:'20px'}}>Fetching location...</div>;
  }

  return (
    <MapContainer
      center={[userLocation.lat, userLocation.lng]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler enabled={reportMode} onSelect={onSelectLocation} />

      <Marker position={[userLocation.lat, userLocation.lng]} icon={greenPin}>
        <Popup>You are here!</Popup>
      </Marker>

      {selectedLocation && (
        <Marker position={selectedLocation} icon={redPin}>
          <Popup>Selected Location</Popup>
        </Marker>
      )}

      {reports.map((r) => (
        <Marker key={r.id} position={[r.latitude, r.longitude]}>
          <Popup>
            <div style={{ maxWidth: '180px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>{r.title}</div>
              <div style={{ fontSize: '11px', marginBottom: '8px', color: '#555' }}>
                  {r.description?.slice(0, 60)}{r.description?.length > 60 ? '...' : ''}
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={(e) => {
                     // We just call the parent handler.
                     // Note: Leaflet popups capture clicks, so sometimes stopPropagation is needed if bubbling causes issues, 
                     // but usually standard onClick works fine for React Leaflet v3/v4 portals.
                     onViewReport(r);
                  }}
                  style={{
                     background: 'transparent',
                     border: '1px solid #333',
                     fontSize: '9px',
                     fontWeight: 'bold',
                     cursor: 'pointer',
                     padding: '3px 8px',
                     color: '#333',
                     textTransform: 'uppercase'
                  }}
                >
                  [ VIEW CASE ]
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}