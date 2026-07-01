import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * ImmersiveFPSViewer — walk inside a photo realm.
 * Drag / touch to look around, WASD or on-screen pad to move.
 * No PointerLock (blocked in iframes) — works everywhere.
 */

interface Props {
  imageUrl: string;
  onExit?: () => void;
}

const getAspect = (t: THREE.Texture) => {
  const img = t.image as HTMLImageElement | undefined;
  if (!img?.width || !img?.height) return 16 / 9;
  return img.width / img.height;
};

const SkySphere = ({ texture }: { texture: THREE.Texture }) => (
  <mesh scale={[-1, 1, 1]}>
    <sphereGeometry args={[80, 96, 48]} />
    <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
  </mesh>
);

const CurvedPhotoRealm = ({ texture }: { texture: THREE.Texture }) => {
  const aspect = getAspect(texture);
  const { radius, height, angle } = useMemo(() => {
    const h = 5.4;
    const r = 5.8;
    return {
      radius: r,
      height: h,
      angle: THREE.MathUtils.clamp((h * aspect) / r, 1.1, 2.6),
    };
  }, [aspect]);
  return (
    <mesh>
      <cylinderGeometry args={[radius, radius, height, 128, 48, true, Math.PI - angle / 2, angle]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
};

interface Look {
  yaw: number;
  pitch: number;
}

const Controller = ({
  look,
  moveVec,
  panorama,
}: {
  look: React.MutableRefObject<Look>;
  moveVec: React.MutableRefObject<{ x: number; z: number }>;
  panorama: boolean;
}) => {
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
    // Apply look rotation
    camera.rotation.order = "YXZ";
    camera.rotation.y = look.current.yaw;
    camera.rotation.x = look.current.pitch;

    const speed = (keys.current["ShiftLeft"] ? 3.2 : 1.6) * delta;
    const forward = new THREE.Vector3(-Math.sin(look.current.yaw), 0, -Math.cos(look.current.yaw));
    const right = new THREE.Vector3(Math.cos(look.current.yaw), 0, -Math.sin(look.current.yaw));

    const dir = new THREE.Vector3();
    if (keys.current["KeyW"] || keys.current["ArrowUp"]) dir.add(forward);
    if (keys.current["KeyS"] || keys.current["ArrowDown"]) dir.sub(forward);
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) dir.add(right);
    if (keys.current["KeyA"] || keys.current["ArrowLeft"]) dir.sub(right);
    // Joystick
    dir.add(forward.clone().multiplyScalar(-moveVec.current.z));
    dir.add(right.clone().multiplyScalar(moveVec.current.x));

    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(speed);
      velocity.current.lerp(dir, 0.45);
    } else {
      velocity.current.lerp(new THREE.Vector3(), 0.25);
    }
    camera.position.add(velocity.current);

    if (panorama) {
      const maxR = 6;
      if (camera.position.length() > maxR) camera.position.setLength(maxR);
    } else {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -2.6, 2.6);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -2.15, 1.1);
    }
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, -0.4, 1.6);
  });

  return null;
};

const ImmersiveFPSViewer = ({ imageUrl, onExit }: Props) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const look = useRef<Look>({ yaw: 0, pitch: 0 });
  const moveVec = useRef({ x: 0, z: 0 });
  const dragging = useRef(false);
  const lastPt = useRef({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setTexture(null);
    setError(null);
    const tryLoad = (useCors: boolean) => {
      const loader = new THREE.TextureLoader();
      if (useCors) loader.setCrossOrigin("anonymous");
      loader.load(
        imageUrl,
        (tex) => {
          if (cancelled) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          setTexture(tex);
        },
        undefined,
        () => {
          if (cancelled) return;
          if (useCors) tryLoad(false);
          else setError("Couldn't load this realm photo.");
        },
      );
    };
    tryLoad(true);
    return () => { cancelled = true; };
  }, [imageUrl]);

  // Drag-to-look (mouse + touch)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const start = (x: number, y: number) => {
      dragging.current = true;
      lastPt.current = { x, y };
    };
    const move = (x: number, y: number) => {
      if (!dragging.current) return;
      const dx = x - lastPt.current.x;
      const dy = y - lastPt.current.y;
      lastPt.current = { x, y };
      look.current.yaw -= dx * 0.005;
      look.current.pitch -= dy * 0.005;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    };
    const end = () => { dragging.current = false; };

    const md = (e: MouseEvent) => start(e.clientX, e.clientY);
    const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
    const mu = () => end();
    const ts = (e: TouchEvent) => { const t = e.touches[0]; if (t) start(t.clientX, t.clientY); };
    const tm = (e: TouchEvent) => { const t = e.touches[0]; if (t) { move(t.clientX, t.clientY); e.preventDefault(); } };
    const te = () => end();

    el.addEventListener("mousedown", md);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", te);
    return () => {
      el.removeEventListener("mousedown", md);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchmove", tm);
      el.removeEventListener("touchend", te);
    };
  }, [texture]);

  const panorama = texture ? getAspect(texture) >= 1.95 : false;

  const setMove = (x: number, z: number) => { moveVec.current = { x, z }; };
  const clearMove = () => { moveVec.current = { x: 0, z: 0 }; };

  return (
    <div ref={stageRef} className="fixed inset-0 z-[100] bg-black cursor-grab active:cursor-grabbing select-none">
      {texture && (
        <Canvas camera={{ position: [0, 0.2, 0.1], fov: 72 }}>
          <Suspense fallback={null}>
            {panorama ? <SkySphere texture={texture} /> : <CurvedPhotoRealm texture={texture} />}
            <Controller look={look} moveVec={moveVec} panorama={panorama} />
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

      {/* HUD hint */}
      {texture && (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/50 px-3 py-1.5 rounded-full backdrop-blur">
          Drag to look · WASD or the pad to walk
        </div>
      )}

      {/* On-screen movement pad (works on mobile + desktop) */}
      {texture && (
        <div className="absolute bottom-6 left-6 grid grid-cols-3 grid-rows-3 gap-1.5 w-40 h-40 select-none">
          <div />
          <button
            className="bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-md text-white text-xl"
            onPointerDown={() => setMove(0, -1)}
            onPointerUp={clearMove}
            onPointerLeave={clearMove}
          >↑</button>
          <div />
          <button
            className="bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-md text-white text-xl"
            onPointerDown={() => setMove(-1, 0)}
            onPointerUp={clearMove}
            onPointerLeave={clearMove}
          >←</button>
          <div />
          <button
            className="bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-md text-white text-xl"
            onPointerDown={() => setMove(1, 0)}
            onPointerUp={clearMove}
            onPointerLeave={clearMove}
          >→</button>
          <div />
          <button
            className="bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-md text-white text-xl"
            onPointerDown={() => setMove(0, 1)}
            onPointerUp={clearMove}
            onPointerLeave={clearMove}
          >↓</button>
          <div />
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
