import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface Photo3DViewerProps {
  imageUrl: string;
  /** Depth strength (0–1). Higher = more pronounced 3D pop. */
  depth?: number;
  /** Auto-orbit subtly when user isn't interacting */
  autoOrbit?: boolean;
}

/**
 * Lightweight 2.5D parallax: builds a subdivided plane and displaces vertices
 * using a luminance-derived depth approximation of the photo. Real-time, free,
 * works on every photo. ~15–30° believable orbit.
 */
function PhotoMesh({ url, depth = 0.35 }: { url: string; depth?: number }) {
  const tex = useLoader(THREE.TextureLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);

  // Build a depth map from the texture (luminance → height)
  const displacementMap = useMemo(() => {
    const img = tex.image as HTMLImageElement;
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size);
    // Smooth + invert so brighter foregrounds pop forward.
    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const v = Math.min(255, lum);
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
    const dt = new THREE.CanvasTexture(canvas);
    dt.needsUpdate = true;
    return dt;
  }, [tex]);

  // Match plane aspect to image aspect
  const aspect = useMemo(() => {
    const img = tex.image as HTMLImageElement;
    return img.width / img.height;
  }, [tex]);

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[aspect * 2, 2, 128, 128]} />
      <meshStandardMaterial
        map={tex}
        displacementMap={displacementMap || undefined}
        displacementScale={depth}
        roughness={1}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GentleOrbit({ enabled }: { enabled: boolean }) {
  useFrame(({ camera, clock }) => {
    if (!enabled) return;
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.3) * 0.4;
    camera.position.y = Math.cos(t * 0.2) * 0.2;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

const Photo3DViewer = ({ imageUrl, depth = 0.35, autoOrbit = false }: Photo3DViewerProps) => {
  const [hasError, setHasError] = useState(false);

  // Reset error if image changes
  useEffect(() => setHasError(false), [imageUrl]);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
        Couldn't load this photo in 3D. Try a different image.
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 45 }}
      onError={() => setHasError(true)}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 2, 3]} intensity={0.6} />
      <Suspense fallback={null}>
        <PhotoMesh url={imageUrl} depth={depth} />
      </Suspense>
      <GentleOrbit enabled={autoOrbit} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={2}
        maxDistance={5}
        minPolarAngle={Math.PI / 2 - 0.6}
        maxPolarAngle={Math.PI / 2 + 0.6}
        minAzimuthAngle={-0.8}
        maxAzimuthAngle={0.8}
        rotateSpeed={0.6}
      />
    </Canvas>
  );
};

export default Photo3DViewer;
