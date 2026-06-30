import { useEffect, useRef, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { X, Battery, Sparkles, Loader2 } from "lucide-react";
import {
  getLowPowerPreference,
  setLowPowerPreference,
  type LowPowerPreference,
} from "@/hooks/useLowPower";

/**
 * QUANTUM VISIBILITY — 8K-realistic 3D world from a generated photo.
 *
 * - Subdivides the plane heavily (256×256) and displaces vertices using a
 *   luminance-derived depth field so the user can fly around inside the photo.
 * - Memory/power diversion: while this viewer is mounted the global
 *   `lowPowerMode` preference is forced to "on" — the rest of the app
 *   (glows, animations, prefetch warmup, background polling) idles down via
 *   the existing `useLowPower()` consumers. The previous preference is
 *   restored on unmount.
 */
interface QuantumPhotoViewerProps {
  imageUrl: string;
  onClose?: () => void;
  /** 0–1. Higher = more pronounced 3D pop. Default 0.55 for "8K realism" feel. */
  depth?: number;
}

function QuantumMesh({ url, depth }: { url: string; depth: number }) {
  const tex = useLoader(THREE.TextureLoader, url);

  const displacementMap = useMemo(() => {
    const img = tex.image as HTMLImageElement;
    const size = 512; // higher-resolution depth field than the lightweight viewer
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = Math.min(255, lum);
    }
    ctx.putImageData(data, 0, 0);
    const dt = new THREE.CanvasTexture(canvas);
    dt.needsUpdate = true;
    return dt;
  }, [tex]);

  const aspect = useMemo(() => {
    const img = tex.image as HTMLImageElement;
    return img.width / img.height;
  }, [tex]);

  // Maximize anisotropic filtering for sharp 8K-style detail at oblique angles.
  useMemo(() => {
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
  }, [tex]);

  return (
    <mesh>
      <planeGeometry args={[aspect * 2.2, 2.2, 256, 256]} />
      <meshStandardMaterial
        map={tex}
        displacementMap={displacementMap || undefined}
        displacementScale={depth}
        roughness={0.95}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function DriftCamera() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x += (Math.sin(t * 0.15) * 0.0008);
    camera.position.y += (Math.cos(t * 0.12) * 0.0006);
  });
  return null;
}

export const QuantumPhotoViewer = ({
  imageUrl,
  onClose,
  depth = 0.55,
}: QuantumPhotoViewerProps) => {
  const [hasError, setHasError] = useState(false);
  const prevPrefRef = useRef<LowPowerPreference | null>(null);

  // POWER DIVERSION: while this 8K viewer is mounted, force low-power on the
  // rest of the app so glows/animations/prefetch back off.
  useEffect(() => {
    prevPrefRef.current = getLowPowerPreference();
    setLowPowerPreference("on");
    return () => {
      if (prevPrefRef.current) setLowPowerPreference(prevPrefRef.current);
    };
  }, []);

  // Lock body scroll while immersive view is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black"
      role="dialog"
      aria-label="Quantum 3D photo viewer"
    >
      {/* HUD */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <div>
            <div className="text-xs uppercase tracking-widest opacity-80">Quantum Visibility</div>
            <div className="text-[10px] opacity-60">Drag to orbit · pinch/scroll to zoom</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-white/10 border border-white/15">
            <Battery className="w-3 h-3 text-emerald-400" />
            Power diverted — rest of app idled
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Exit 3D world"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm px-6 text-center">
          Couldn't load this photo in 3D. Try another image.
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center text-white/80">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Building 3D world…
            </div>
          }
        >
          <Canvas
            camera={{ position: [0, 0, 3.2], fov: 50 }}
            gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
            dpr={[1, 2]}
            onError={() => setHasError(true)}
          >
            <ambientLight intensity={0.85} />
            <directionalLight position={[3, 2, 4]} intensity={0.7} />
            <directionalLight position={[-3, -2, 2]} intensity={0.25} />
            <Suspense fallback={null}>
              <QuantumMesh url={imageUrl} depth={depth} />
            </Suspense>
            <DriftCamera />
            <OrbitControls
              enablePan
              enableZoom
              minDistance={1.2}
              maxDistance={6}
              minPolarAngle={Math.PI / 2 - 1.0}
              maxPolarAngle={Math.PI / 2 + 1.0}
              minAzimuthAngle={-1.2}
              maxAzimuthAngle={1.2}
              rotateSpeed={0.7}
              zoomSpeed={0.8}
              panSpeed={0.6}
            />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
};

export default QuantumPhotoViewer;
