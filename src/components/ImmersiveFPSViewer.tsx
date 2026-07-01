import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * ImmersiveFPSViewer — FPS-style walk-around inside a scene.
 * Wraps the photo on the inside of a large sphere so you can look/walk around.
 * Loads the texture manually with CORS + error handling so it never gets
 * stuck on a blank canvas.
 */

interface Props {
  imageUrl: string;
  onExit?: () => void;
}

const getTextureAspect = (texture: THREE.Texture) => {
  const image = texture.image as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!image?.width || !image?.height) return 16 / 9;
  return image.width / image.height;
};

const SkySphere = ({ texture }: { texture: THREE.Texture }) => (
  <mesh>
    <sphereGeometry args={[80, 96, 48]} />
    <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
  </mesh>
);

const CurvedPhotoRealm = ({ texture }: { texture: THREE.Texture }) => {
  const aspect = getTextureAspect(texture);
  const { radius, height, angle } = useMemo(() => {
    const h = 5.4;
    const r = 5.8;
    return {
      radius: r,
      height: h,
      angle: THREE.MathUtils.clamp((h * aspect) / r, 0.95, 2.45),
    };
  }, [aspect]);

  return (
    <mesh>
      <cylinderGeometry args={[radius, radius, height, 128, 48, true, Math.PI - angle / 2, angle]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
};

const Floor = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
    <circleGeometry args={[10, 64]} />
    <meshBasicMaterial color="#050505" transparent opacity={0.18} />
  </mesh>
);

const WalkController = ({ panorama }: { panorama: boolean }) => {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    const speed = (keys.current["ShiftLeft"] ? 2.8 : 1.35) * delta;
    const dir = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

    if (keys.current["KeyW"] || keys.current["ArrowUp"]) dir.add(forward);
    if (keys.current["KeyS"] || keys.current["ArrowDown"]) dir.sub(forward);
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) dir.add(right);
    if (keys.current["KeyA"] || keys.current["ArrowLeft"]) dir.sub(right);

    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(speed);
      velocity.current.lerp(dir, 0.4);
    } else {
      velocity.current.lerp(new THREE.Vector3(), 0.2);
    }
    camera.position.add(velocity.current);

    if (panorama) {
      const maxR = 6;
      if (camera.position.length() > maxR) camera.position.setLength(maxR);
    } else {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -2.6, 2.6);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -2.15, 1.1);
    }
    camera.position.y = Math.max(-0.45, Math.min(1.8, camera.position.y));
  });

  return null;
};

const ImmersiveFPSViewer = ({ imageUrl, onExit }: Props) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const controlsRef = useRef<any>(null);

  // Manually load the image with CORS so remote URLs (Gemini/Supabase storage)
  // don't hang the Canvas Suspense forever.
  useEffect(() => {
    let cancelled = false;
    setTexture(null);
    setError(null);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      imageUrl,
      (tex) => {
        if (cancelled) return;
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setTexture(tex);
      },
      undefined,
      () => {
        if (cancelled) return;
        // Retry without CORS in case the origin doesn't send CORS headers
        const fallback = new THREE.TextureLoader();
        fallback.load(
          imageUrl,
          (tex) => {
            if (cancelled) return;
            tex.mapping = THREE.EquirectangularReflectionMapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            setTexture(tex);
          },
          undefined,
          () => !cancelled && setError("Couldn't load this realm photo."),
        );
      },
    );
    return () => { cancelled = true; };
  }, [imageUrl]);

  const enterWalk = () => {
    try { controlsRef.current?.lock?.(); } catch { /* no-op */ }
  };

  const panorama = texture ? getTextureAspect(texture) >= 1.95 : false;

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {texture && (
        <Canvas camera={{ position: [0, 0, 0.1], fov: 66 }}>
          <Suspense fallback={null}>
            {panorama ? <SkySphere texture={texture} /> : <CurvedPhotoRealm texture={texture} />}
            <Floor />
            <WalkController panorama={panorama} />
            <PointerLockControls
              ref={controlsRef}
              onLock={() => setLocked(true)}
              onUnlock={() => setLocked(false)}
            />
          </Suspense>
        </Canvas>
      )}

      {!texture && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Loading realm…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-red-300 text-sm p-6">
          {error}
        </div>
      )}

      {texture && !locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <button
            onClick={enterWalk}
            className="px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-2xl"
          >
            Enter realm
          </button>
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
