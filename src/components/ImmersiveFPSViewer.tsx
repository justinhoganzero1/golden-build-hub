import { useEffect, useMemo, useState, Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * ImmersiveFPSViewer — walkable 3D room built from the source photo plus
 * AI-inpainted side/back views. Each wall is a depth-displaced mesh (using an
 * AI depth map when supplied, otherwise falling back to per-image luminance),
 * so the user can orbit fully around inside the scene without hitting the
 * blank-wall / cylinder-flip artefact.
 */

interface Props {
  imageUrl: string;
  depthUrl?: string | null;
  leftUrl?: string | null;
  rightUrl?: string | null;
  backUrl?: string | null;
  onExit?: () => void;
}

/** Build a THREE.CanvasTexture heightmap from an image's luminance. */
function luminanceTexture(img: HTMLImageElement): THREE.CanvasTexture | null {
  if (!img) return null;
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < d.data.length; i += 4) {
    const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    d.data[i] = d.data[i + 1] = d.data[i + 2] = lum;
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function Wall({
  url,
  depthOverrideUrl,
  position,
  rotationY,
  width = 8,
  height = 4.5,
}: {
  url: string;
  depthOverrideUrl?: string | null;
  position: [number, number, number];
  rotationY: number;
  width?: number;
  height?: number;
}) {
  const tex = useLoader(THREE.TextureLoader, url);
  const depthTex = useLoader(
    THREE.TextureLoader,
    depthOverrideUrl || url,
  );

  const displacement = useMemo(() => {
    if (depthOverrideUrl) {
      // AI-supplied depth map — use luminance directly (it's already grayscale).
      return luminanceTexture(depthTex.image as HTMLImageElement);
    }
    return luminanceTexture(tex.image as HTMLImageElement);
  }, [tex, depthTex, depthOverrideUrl]);

  tex.colorSpace = THREE.SRGBColorSpace;

  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height, 200, 200]} />
      <meshStandardMaterial
        map={tex}
        displacementMap={displacement || undefined}
        displacementScale={-1.4} // inward — walls dent toward the viewer inside the room
        roughness={0.95}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

const ImmersiveFPSViewer = ({
  imageUrl, depthUrl, leftUrl, rightUrl, backUrl, onExit,
}: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

  // Room is 8 wide (front/back) x 4.5 tall x 8 deep. Camera starts at origin.
  const half = 4;
  const sidesReady = Boolean(leftUrl && rightUrl && backUrl);

  return (
    <div className="fixed inset-0 z-[100] bg-black select-none">
      {ready && !error && (
        <Canvas camera={{ position: [0, 0, 0.01], fov: 70 }} gl={{ antialias: true }}>
          <ambientLight intensity={1.15} />
          <directionalLight position={[3, 4, 5]} intensity={0.6} />
          <directionalLight position={[-3, -2, -5]} intensity={0.35} />
          <Suspense fallback={null}>
            {/* Front wall */}
            <Wall
              url={imageUrl}
              depthOverrideUrl={depthUrl}
              position={[0, 0, -half]}
              rotationY={0}
            />
            {sidesReady && (
              <>
                <Wall url={leftUrl!} position={[-half, 0, 0]} rotationY={Math.PI / 2} />
                <Wall url={rightUrl!} position={[half, 0, 0]} rotationY={-Math.PI / 2} />
                <Wall url={backUrl!} position={[0, 0, half]} rotationY={Math.PI} />
              </>
            )}
          </Suspense>
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={0.1}
            maxDistance={half - 0.2}
            rotateSpeed={-0.5}
            zoomSpeed={0.9}
            panSpeed={0.5}
            target={[0, 0, -0.5]}
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
          {sidesReady ? "Look around · scroll to move · right-drag to pan" : "Look around · sides still rendering…"}
        </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className="absolute top-4 right-4 px-3 py-2 rounded-md bg-black/55 hover:bg-black/75 border border-white/15 text-white text-sm z-10"
      >
        Exit
      </button>
    </div>
  );
};

export default ImmersiveFPSViewer;
