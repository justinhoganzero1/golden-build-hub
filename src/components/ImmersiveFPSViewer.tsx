import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * ImmersiveFPSViewer — true 3D orbit around the photo.
 *
 * The image is turned into a depth-displaced mesh (luminance heightmap) so the
 * viewer can rotate FULLY around it and see actual sides — no blank wall, no
 * cylinder flip. Drag to orbit, scroll / pinch to zoom.
 */

interface Props {
  imageUrl: string;
  onExit?: () => void;
}

function PhotoDepthMesh({ url }: { url: string }) {
  const tex = useLoader(THREE.TextureLoader, url);

  const { displacement, aspect } = useMemo(() => {
    const img = tex.image as HTMLImageElement;
    const a = img?.width && img?.height ? img.width / img.height : 16 / 9;
    const size = 512;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    let dt: THREE.CanvasTexture | null = null;
    if (ctx && img) {
      ctx.drawImage(img, 0, 0, size, size);
      const d = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < d.data.length; i += 4) {
        const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = lum;
      }
      ctx.putImageData(d, 0, 0);
      dt = new THREE.CanvasTexture(c);
      dt.needsUpdate = true;
    }
    return { displacement: dt, aspect: a };
  }, [tex]);

  tex.colorSpace = THREE.SRGBColorSpace;

  const w = 4 * aspect;
  const h = 4;

  return (
    <group>
      {/* Front photo mesh with depth displacement */}
      <mesh>
        <planeGeometry args={[w, h, 256, 256]} />
        <meshStandardMaterial
          map={tex}
          displacementMap={displacement || undefined}
          displacementScale={1.2}
          roughness={0.9}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Mirrored back so orbiting behind still shows the scene */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.02]}>
        <planeGeometry args={[w, h, 256, 256]} />
        <meshStandardMaterial
          map={tex}
          displacementMap={displacement || undefined}
          displacementScale={1.2}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
          opacity={0.7}
          transparent
        />
      </mesh>
    </group>
  );
}

const ImmersiveFPSViewer = ({ imageUrl, onExit }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Preflight so we can report a friendly error if the URL 404s or is CORS-blocked.
  useEffect(() => {
    setReady(false); setError(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setReady(true);
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => setReady(true);
      img2.onerror = () => setError("Couldn't load this realm photo.");
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  return (
    <div className="fixed inset-0 z-[100] bg-black select-none">
      {ready && !error && (
        <Canvas camera={{ position: [0, 0, 6], fov: 55 }} gl={{ antialias: true }}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[3, 4, 5]} intensity={0.7} />
          <directionalLight position={[-3, -2, -5]} intensity={0.4} />
          <Suspense fallback={null}>
            <PhotoDepthMesh url={imageUrl} />
          </Suspense>
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={1.2}
            maxDistance={14}
            rotateSpeed={0.9}
            zoomSpeed={0.9}
            panSpeed={0.7}
            makeDefault
          />
        </Canvas>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Building 3D realm…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-red-300 text-sm p-6">
          {error}
        </div>
      )}

      {ready && !error && (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 text-white/85 text-xs bg-black/55 px-3 py-1.5 rounded-full backdrop-blur">
          Drag to orbit · scroll / pinch to zoom · right-drag to pan
        </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className="absolute top-4 right-4 px-3 py-2 rounded-md bg-black/55 hover:bg-black/75 border border-white/15 text-white text-sm"
      >
        Exit
      </button>
    </div>
  );
};

export default ImmersiveFPSViewer;
