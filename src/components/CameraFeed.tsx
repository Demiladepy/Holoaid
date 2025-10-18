import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { motion } from "framer-motion";
import ThreeScene from './ThreeScene';

const CameraFeed: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [status, setStatus] = useState("Loading AI Model...");
  const [detections, setDetections] = useState<any[]>([]);
  // expose simplified objects for the 3D overlay
  const [overlayObjects, setOverlayObjects] = useState<any[]>([]);
  const [overlayEnabled, setOverlayEnabled] = useState<boolean>(false);
  const [overlayReady, setOverlayReady] = useState<boolean>(false);

  // 🔹 Load TensorFlow Model
  useEffect(() => {
    const loadModel = async () => {
      setStatus("Loading TensorFlow Model...");
      const loadedModel = await cocoSsd.load();
      setModel(loadedModel);
      setStatus("Model Loaded ✅");
    };
    tf.ready().then(loadModel);
  }, []);

  // 🔹 Start Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("Camera access denied ❌");
      }
    };
    startCamera();
  }, []);

  // 🔹 Continuous Detection
  useEffect(() => {
    let animationFrameId: number;

    const detectFrame = async () => {
      if (model && videoRef.current && videoRef.current.readyState === 4) {
        const predictions = await model.detect(videoRef.current);
        setDetections(predictions);
        drawBoxes(predictions);
      }
      animationFrameId = requestAnimationFrame(detectFrame);
    };

    const drawBoxes = (predictions: any[]) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !canvasRef.current || !videoRef.current) return;

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      const { videoWidth, videoHeight } = videoRef.current;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      predictions.forEach((p) => {
        const [x, y, width, height] = p.bbox;
        ctx.strokeStyle = "#00ff99";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#00ffaa";
        ctx.shadowBlur = 15;
        ctx.strokeRect(x, y, width, height);
        ctx.font = "18px Poppins";
        ctx.fillStyle = "#00ffcc";
        ctx.fillText(p.class, x + 6, y > 10 ? y - 5 : 10);
      });
        // create overlay objects normalized to [0..1] center coordinates
        const overlay = predictions.map((p) => {
          const [x, y, width, height] = p.bbox;
          const cx = x + width / 2;
          const cy = y + height / 2;
          // normalize by video dimensions
          const { videoWidth, videoHeight } = videoRef.current!;
          return {
            bbox: [cx / videoWidth, cy / videoHeight, width / videoWidth, height / videoHeight],
            class: p.class,
            score: p.score,
          };
        });
        setOverlayObjects(overlay);
    };

    if (model) detectFrame();

    return () => cancelAnimationFrame(animationFrameId);
  }, [model]);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="camera-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Live Camera</h2>
            <p className="text-sm muted">Real-time object detection feed</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm muted">{status}</div>
            <button
              className="theme-toggle text-sm"
              onClick={() => {
                // if disabling, reset ready state
                if (overlayEnabled) setOverlayReady(false);
                setOverlayEnabled((s) => !s);
              }}
              aria-pressed={overlayEnabled}
              aria-label="Toggle 3D overlay"
            >
              {!overlayEnabled ? 'Show 3D' : !overlayReady ? 'Loading 3D...' : 'Hide 3D'}
            </button>
          </div>
        </div>

        <div className="camera-frame">
          {/* 🎥 Camera Feed */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="camera-video"
          />

          {/* 🖼️ Canvas Overlay for Boxes */}
          <canvas
            ref={canvasRef}
            className="overlay-canvas"
          />

            {/* 3D overlay: confined to the camera-frame container */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {overlayEnabled && <ThreeScene objects={overlayObjects} onReady={() => setOverlayReady(true)} />}
            </div>

          {/* 💬 Floating Detection Label */}
          {detections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 detection-pill"
            >
              <strong className="font-semibold">{detections[0].class}</strong>
            </motion.div>
          )}
        </div>
      </div>

      {/* status for small screens */}
      <p className="text-sm muted">{status}</p>
      {/* end component */}
    </div>
  );
};

export default CameraFeed;
