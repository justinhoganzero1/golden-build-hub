import { useEffect, useRef, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * ImmersiveFPSViewer — fast, smooth 360° panorama viewer.
 *
 * Rewrite: dropped the displaced walls / heightfield / collision system that
 * was tanking framerates. When you already have a full 360 skydome around the
 * viewer, all that geometry is wasted work. This is now a pure equirectangular
 * pano viewer (Street-View style): one inward-facing sphere, drag to look,
 * pinch / scroll to zoom, works great on mobile.
 */

interface Props {
  imageUrl: string;
  // Kept for API compatibility with existing call sites; unused in the fast viewer.
  depthUrl?: string | null;
  leftUrl?: string | null;
  rightUrl?: string | null;
  backUrl?: string | null;
  onExit?: () => void;
}

const MIN_FOV = 35;
const MAX_FOV = 95;
const DEFAULT_FOV = 75;

function Sky({ url }: { url: string }) {
  const tex = useLoader(THREE.TextureLoader, url);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.anisotropy = 4;
  }, [tex]);
  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-1}>
      {/* scale.x = -1 flips normals inward so we see the inside of the sphere */}
      <sphereGeometry args={[500, 64, 40]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function PanoControls({ fovRef }: { fovRef: React.MutableRefObject<number> }) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const targetFov = useRef(DEFAULT_FOV);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";

    let dragging = false;
    let lastX = 0, lastY = 0;
    let pinchStart = 0;
    let pinchStartFov = DEFAULT_FOV;
    const pointers = new Map<number, { x: number; y: number }>();

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true;
        lastX = e.clientX; lastY = e.clientY;
        el.style.cursor = "grabbing";
      } else if (pointers.size === 2) {
        dragging = false;
        const pts = Array.from(pointers.values());
        pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchStartFov = targetFov.current;
      }
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (pinchStart > 0) {
          const ratio = pinchStart / d;
          targetFov.current = Math.min(MAX_FOV, Math.max(MIN_FOV, pinchStartFov * ratio));
        }
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      // Sensitivity scales with FOV so zoomed-in looks are finer
      const sens = (targetFov.current / 75) * 0.0035;
      targetYaw.current   -= dx * sens;
      targetPitch.current -= dy * sens;
      const lim = Math.PI / 2 - 0.02;
      if (targetPitch.current >  lim) targetPitch.current =  lim;
      if (targetPitch.current < -lim) targetPitch.current = -lim;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      try { el.releasePointerCapture?.(e.pointerId); } catch {}
      if (pointers.size === 0) {
        dragging = false;
        el.style.cursor = "grab";
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = targetFov.current + e.deltaY * 0.05;
      targetFov.current = Math.min(MAX_FOV, Math.max(MIN_FOV, next));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame(() => {
    // Smooth exponential easing → butter-smooth even at low frame budgets
    yaw.current   += (targetYaw.current   - yaw.current)   * 0.18;
    pitch.current += (targetPitch.current - pitch.current) * 0.18;
    euler.set(pitch.current, yaw.current, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);
    const pcam = camera as THREE.PerspectiveCamera;
    if (Math.abs(pcam.fov - targetFov.current) > 0.05) {
      pcam.fov += (targetFov.current - pcam.fov) * 0.18;
      pcam.updateProjectionMatrix();
      fovRef.current = pcam.fov;
    }
  });

  return null;
}

const ImmersiveFPSViewer = ({ imageUrl, onExit }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const fovRef = useRef(DEFAULT_FOV);

  useEffect(() => {
    setReady(false); setError(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setReady(true);
    img.onerror = () => {
      // retry without CORS in case the CDN doesn't send the header
      const img2 = new Image();
      img2.onload = () => setReady(true);
      img2.onerror = () => setError("Couldn't load this realm photo.");
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const t = setTimeout(() => setShowHelp(false), 4500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black select-none">
      {ready && !error && (
        <Canvas
          camera={{ position: [0, 0, 0.01], fov: DEFAULT_FOV, near: 0.1, far: 1000 }}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          dpr={[1, Math.min(window.devicePixelRatio || 1, 1.75)]}
          frameloop="always"
        >
          <Suspense fallback={null}>
            <Sky url={imageUrl} />
          </Suspense>
          <PanoControls fovRef={fovRef} />
        </Canvas>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Loading 360° realm…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-red-300 text-sm p-6">
          {error}
        </div>
      )}

      {ready && !error && showHelp && (
        <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 text-white/85 text-xs bg-black/70 px-3 py-2 rounded-full backdrop-blur border border-white/10 flex items-center gap-3">
          <span>Drag to look around · Pinch or scroll to zoom</span>
          <button onClick={() => setShowHelp(false)} className="text-white/50 hover:text-white">×</button>
        </div>
      )}

      <button
        type="button"
        onClick={() => onExit?.()}
        className="absolute top-4 right-4 px-3 py-2 rounded-md bg-black/60 hover:bg-black/80 border border-white/15 text-white text-sm z-10"
      >
        Exit
      </button>

      {ready && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
        </div>
      )}
    </div>
  );
};

export default ImmersiveFPSViewer;
