import React, { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert("Unable to access camera");
        onClose();
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Capture photo
  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
        if (onClose) onClose();
      },
      "image/jpeg",
      0.95
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center">
      <div className="bg-white rounded-lg p-4 w-[90%] max-w-md relative shadow-xl">
        <h2 className="text-lg font-semibold mb-3">Camera</h2>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full rounded-md bg-black"
        />

        <canvas ref={canvasRef} className="hidden"></canvas>

        <div className="flex justify-between mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded"
          >
            Close
          </button>

          <button
            onClick={takePhoto}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
