import { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

/**
 * ImmersiveFPSViewer — FPS-style walk-around inside a scene.
 * Renders the scene image on the inside of a large sphere and lets the user
 * look around with the mouse (pointer lock) and walk with WASD / arrow keys.
 */

interface Props {
  imageUrl: string;
  /** Called when the user presses Escape or exits pointer lock. */
  onExit?: () => void;
}

const SkySphere = ({ url }: { url: string }) => {
  const texture = useTexture(url);
  useEffect(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
};

const Floor = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
    <circleGeometry args={[40, 48]} />
    <meshBasicMaterial color="#050505" transparent opacity={0.35} />
  </mesh>
);

const WalkController = () => {
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
    const speed = (keys.current["ShiftLeft"] ? 12 : 5) * delta;
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

    // Clamp inside sphere radius
    const maxR = 40;
    if (camera.position.length() > maxR) {
      camera.position.setLength(maxR);
    }
    camera.position.y = Math.max(-1.5, Math.min(3, camera.position.y));
  });

  return null;
};

const ImmersiveFPSViewer = ({ imageUrl, onExit }: Props) => {
  const [locked, setLocked] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={canvasWrapRef} className="relative w-full h-full bg-black">
      <Canvas camera={{ position: [0, 0, 0.1], fov: 75 }}>
        <Suspense fallback={null}>
          <SkySphere url={imageUrl} />
          <Floor />
          <WalkController />
          <PointerLockControls
            onLock={() => setLocked(true)}
            onUnlock={() => { setLocked(false); onExit?.(); }}
          />
        </Suspense>
      </Canvas>

      {!locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="text-center text-white px-4 py-3 rounded-lg bg-black/60 border border-white/10">
            <p className="font-semibold text-sm mb-1">Click the scene to enter walk mode</p>
            <p className="text-[11px] text-white/70">WASD / arrows to walk · Shift = run · Mouse to look · Esc to exit</p>
          </div>
        </div>
      )}
      <div className="absolute inset-0" onClick={(e) => {
        if (locked) return;
        const canvas = (e.currentTarget.parentElement?.querySelector("canvas") as HTMLCanvasElement | null);
        canvas?.requestPointerLock?.();
      }} />
    </div>
  );
};

export default ImmersiveFPSViewer;
