import React, { useEffect, useRef, useState } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Component นี้จะจัดการการเปิดกล้องและตรวจจับท่าทาง
const PoseDetector = ({ onJump, onReady }) => {
  const videoRef = useRef(null);
  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [webcamRunning, setWebcamRunning] = useState(false);

  // --- Jump Detection Logic ---
  const jumpThreshold = 0.018;
  const jumpCooldown = 1.5; // วินาที
  let lastJumpTime = 0;
  let isJumpingState = false;

  // 1. Setup: โหลดโมเดล MediaPipe
  useEffect(() => {
    const createPoseLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      setPoseLandmarker(landmarker);
      onReady(true); // บอก Component แม่ว่าพร้อมแล้ว
    };
    createPoseLandmarker();
  }, [onReady]);

  // 2. เปิด/ปิด เว็บแคม
  const toggleWebcam = () => {
    if (!poseLandmarker) return;

    if (webcamRunning) {
      setWebcamRunning(false);
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    } else {
      setWebcamRunning(true);
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
      });
    }
  };

  // 3. Loop การประมวลผล (คล้ายกับ while loop ใน Python)
  const predictWebcam = () => {
    if (!videoRef.current || !webcamRunning) return;

    const startTimeMs = performance.now();
    const results = poseLandmarker.detectForVideo(videoRef.current, startTimeMs);

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];

      // --- Logic การคำนวณการยกเข่า (เหมือนใน Python) ---
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftKnee = landmarks[25];
      const rightKnee = landmarks[26];

      if (leftHip && rightHip && leftKnee && rightKnee) {
        const hipY = (leftHip.y + rightHip.y) / 2;
        const leftKneeHeight = hipY - leftKnee.y;
        const rightKneeHeight = hipY - rightKnee.y;

        const kneeRaised = leftKneeHeight > jumpThreshold || rightKneeHeight > jumpThreshold;

        // --- Logic การตรวจจับการกระโดด (เหมือนใน Python) ---
        const currentTime = performance.now() / 1000;
        if (currentTime - lastJumpTime > jumpCooldown) {
          if (kneeRaised && !isJumpingState) {
            isJumpingState = true;
            lastJumpTime = currentTime;
            onJump(); // ส่งคำสั่งกระโดดกลับไปให้ Component แม่
          } else if (!kneeRaised) {
            isJumpingState = false;
          }
        }
      }
    }

    // วน Loop เพื่อประมวลผลเฟรมถัดไป
    requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="pose-detector">
      <video ref={videoRef} autoPlay style={{ transform: "scaleX(-1)", width: "320px", height: "240px" }} />
      <button onClick={toggleWebcam}>
        {webcamRunning ? "ปิดกล้อง" : "เปิดกล้อง"}
      </button>
    </div>
  );
};

export default PoseDetector;