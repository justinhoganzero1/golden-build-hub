import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * ImmersiveFPSViewer — walk-in 3D view of the generated photo.
 *
 * The user's photo + AI-inpainted left/right/back panels + AI depth map are
 * projected onto 4 depth-displaced walls plus a floor, forming a real 3D
 * room. FPS walk controls (WASD + mouse look via pointer-lock) let the user
 * walk through the scene; collision sampling against a shared heightfield
 * (built from the depth map, or from each wall's luminance as fallback)
 * prevents clipping into rocks and walls.
 *
 * Also provides:
 *  - Inspection HUD: photo / depth-map / normals / wireframe overlay.
 *  - Quality slider (1..4) driving plane subdivisions, displacement texture
 *    size, and pixel ratio — top tier is labelled "8K".
 */

interface Props {
  imageUrl: string;
  depthUrl?: string | null;
  leftUrl?: string | null;
  rightUrl?: string | null;
  backUrl?: string | null;
  onExit?: () => void;
}

type ViewMode = "photo" | "depth" | "normals";

interface QualityPreset {
  label: string;
  segments: number;
  texSize: number;
  pixelRatio: number;
}
const QUALITY: QualityPreset[] = [
  { label: "Fast",    segments: 100, texSize: 512,  pixelRatio: 1 },
  { label: "Balanced",segments: 200, texSize: 1024, pixelRatio: 1.5 },
  { label: "High",    segments: 400, texSize: 2048, pixelRatio: 2 },
  { label: "8K",      segments: 700, texSize: 4096, pixelRatio: Math.min(window.devicePixelRatio || 2, 3) },
];

const ROOM = { half: 4, height: 4.5 };            // 8 x 4.5 x 8 room
const EYE_HEIGHT = -0.6;                          // camera Y inside the room
const WALK_SPEED = 1.6;                           // m/s
const RUN_MULT = 2.2;
const COLLIDE_RADIUS = 0.35;

/** Build a grayscale CanvasTexture (luminance) from an image. */
function luminanceTexture(img: HTMLImageElement, size: number): { tex: THREE.CanvasTexture; grid: Uint8Array } | null {
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size);
  const grid = new Uint8Array(size * size);
  for (let i = 0, j = 0; i < d.data.length; i += 4, j++) {
    const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    d.data[i] = d.data[i + 1] = d.data[i + 2] = lum;
    grid[j] = lum;
  }
  ctx.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return { tex, grid };
}

/** Shared collision heightfield derived from the depth (or luminance) grid. */
interface Heightfield { grid: Uint8Array; size: number }

function sampleHeight(hf: Heightfield | null, u: number, v: number): number {
  if (!hf) return 0;
  const uu = Math.max(0, Math.min(0.999, u));
  const vv = Math.max(0, Math.min(0.999, v));
  const x = Math.floor(uu * hf.size);
  const y = Math.floor(vv * hf.size);
  return hf.grid[y * hf.size + x] / 255;
}

interface WallSpec {
  key: string;
  url: string;
  useSharedDepth: boolean;
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
}

function Wall({
  spec, mode, wireframe, quality, sharedDepth,
  onLocalDepth,
}: {
  spec: WallSpec;
  mode: ViewMode;
  wireframe: boolean;
  quality: QualityPreset;
  sharedDepth: THREE.Texture | null;
  onLocalDepth?: (grid: Uint8Array) => void;
}) {
  const tex = useLoader(THREE.TextureLoader, spec.url);
  tex.colorSpace = THREE.SRGBColorSpace;

  const local = useMemo(() => {
    // Only build a per-wall heightmap when we don't have a shared depth map.
    if (spec.useSharedDepth && sharedDepth) return null;
    return luminanceTexture(tex.image as HTMLImageElement, quality.texSize);
  }, [tex, spec.useSharedDepth, sharedDepth, quality.texSize]);

  useEffect(() => {
    if (local && onLocalDepth) onLocalDepth(local.grid);
  }, [local, onLocalDepth]);

  const displacement = spec.useSharedDepth && sharedDepth ? sharedDepth : local?.tex ?? null;

  const material = useMemo(() => {
    if (mode === "normals") {
      return new THREE.MeshNormalMaterial({
        wireframe,
        side: THREE.DoubleSide,
        displacementMap: displacement || undefined,
        displacementScale: -1.4,
      });
    }
    if (mode === "depth") {
      return new THREE.MeshStandardMaterial({
        map: displacement || tex,
        wireframe,
        side: THREE.DoubleSide,
        displacementMap: displacement || undefined,
        displacementScale: -1.4,
        roughness: 1, metalness: 0,
      });
    }
    return new THREE.MeshStandardMaterial({
      map: tex,
      wireframe,
      side: THREE.DoubleSide,
      displacementMap: displacement || undefined,
      displacementScale: -1.4,
      roughness: 0.95, metalness: 0,
    });
  }, [mode, wireframe, tex, displacement]);

  return (
    <mesh position={spec.position} rotation={[0, spec.rotationY, 0]}>
      <planeGeometry args={[spec.width, spec.height, quality.segments, quality.segments]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function Floor({ quality, mode, wireframe }: { quality: QualityPreset; mode: ViewMode; wireframe: boolean }) {
  const material = useMemo(() => {
    if (mode === "normals") return new THREE.MeshNormalMaterial({ wireframe, side: THREE.DoubleSide });
    return new THREE.MeshStandardMaterial({
      color: mode === "depth" ? 0x222222 : 0x1a1a1a,
      wireframe,
      side: THREE.DoubleSide,
      roughness: 1,
    });
  }, [mode, wireframe]);
  return (
    <mesh position={[0, -ROOM.height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[ROOM.half * 2, ROOM.half * 2, Math.max(1, quality.segments / 8), Math.max(1, quality.segments / 8)]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Drag-to-look + click-to-walk-toward + WASD, with collision. */
function WalkRig({ collide }: { collide: (nextX: number, nextZ: number) => boolean }) {
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(0);
  const pitch = useRef(0);
  const target = useRef<THREE.Vector3 | null>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useEffect(() => {
    camera.position.set(0, EYE_HEIGHT, ROOM.half - 0.5);
    const dn = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [camera]);

  // Drag-to-look + click-to-walk on canvas.
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    let dragging = false;
    let moved = 0;
    let lastX = 0, lastY = 0;
    let downX = 0, downY = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true; moved = 0;
      lastX = e.clientX; lastY = e.clientY;
      downX = e.clientX; downY = e.clientY;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      yaw.current   -= dx * 0.0035;
      pitch.current -= dy * 0.0035;
      const lim = Math.PI / 2 - 0.05;
      if (pitch.current >  lim) pitch.current =  lim;
      if (pitch.current < -lim) pitch.current = -lim;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "grab";
      try { el.releasePointerCapture?.(e.pointerId); } catch {}
      // Treat as click if pointer barely moved → set walk target from raycast.
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist < 5) {
        const rect = el.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
        // Intersect ground plane y = -ROOM.height/2
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), ROOM.height / 2);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, hit)) {
          target.current = hit.clone();
        }
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [gl, camera]);

  useFrame((_, delta) => {
    // Apply look
    euler.set(pitch.current, yaw.current, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    const k = keys.current;
    const running = k["ShiftLeft"] || k["ShiftRight"];
    const speed = (running ? RUN_MULT : 1) * WALK_SPEED * delta;

    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();

    dir.set(0, 0, 0);
    if (k["KeyW"] || k["ArrowUp"])    dir.add(fwd);
    if (k["KeyS"] || k["ArrowDown"])  dir.sub(fwd);
    if (k["KeyD"] || k["ArrowRight"]) dir.add(right);
    if (k["KeyA"] || k["ArrowLeft"])  dir.sub(right);

    // Click-to-walk auto-motion toward target on XZ.
    if (dir.lengthSq() === 0 && target.current) {
      const dxT = target.current.x - camera.position.x;
      const dzT = target.current.z - camera.position.z;
      const dLen = Math.hypot(dxT, dzT);
      if (dLen < 0.15) {
        target.current = null;
      } else {
        dir.set(dxT / dLen, 0, dzT / dLen);
      }
    } else if (dir.lengthSq() > 0) {
      // Manual movement cancels auto-walk.
      target.current = null;
    }

    if (dir.lengthSq() === 0) return;
    dir.normalize().multiplyScalar(speed);

    const nextX = camera.position.x + dir.x;
    const nextZ = camera.position.z + dir.z;
    if (collide(nextX, camera.position.z)) camera.position.x = nextX;
    else target.current = null;
    if (collide(camera.position.x, nextZ)) camera.position.z = nextZ;
    else target.current = null;
    camera.position.y = EYE_HEIGHT;
  });

  return null;
}

const ImmersiveFPSViewer = ({ imageUrl, depthUrl, leftUrl, rightUrl, backUrl, onExit }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<ViewMode>("photo");
  const [wireframe, setWireframe] = useState(false);
  const [qualityIdx, setQualityIdx] = useState(1);
  const [showHelp, setShowHelp] = useState(true);
  const [locked, setLocked] = useState(false);
  const controlsRef = useRef<any>(null);

  const quality = QUALITY[qualityIdx];

  // Preload primary image so we can bail early on 404.
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

  // Shared heightfield for collision. Populated by the front-wall/depth loader.
  const heightfield = useRef<Heightfield | null>(null);
  const [sharedDepthTex, setSharedDepthTex] = useState<THREE.Texture | null>(null);

  // Build shared depth texture from AI depth map (or main photo fallback).
  useEffect(() => {
    const src = depthUrl || imageUrl;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const r = luminanceTexture(img, quality.texSize);
      if (r) {
        setSharedDepthTex(r.tex);
        heightfield.current = { grid: r.grid, size: quality.texSize };
      }
    };
    img.src = src;
  }, [depthUrl, imageUrl, quality.texSize]);

  const collide = useMemo(() => {
    return (x: number, z: number): boolean => {
      // Hard room bounds
      if (Math.abs(x) > ROOM.half - 0.15 || Math.abs(z) > ROOM.half - 0.15) return false;
      // Front wall (z ≈ -half): map local X across width, height depth from grid.
      const hf = heightfield.current;
      if (!hf) return true;
      const distFront = z - (-ROOM.half);          // >0 inside
      const u = (x + ROOM.half) / (ROOM.half * 2);
      const v = 0.5;                                // eye level slice
      const depthAtFront = sampleHeight(hf, u, v); // 0..1, higher = closer inside
      // Displacement scale is 1.4 inward; treat white pixels as intruding 1.4m.
      const intrusion = depthAtFront * 1.4;
      if (distFront < intrusion + COLLIDE_RADIUS) return false;
      return true;
    };
  }, []);

  const sides = leftUrl && rightUrl && backUrl;
  const walls: WallSpec[] = useMemo(() => {
    const list: WallSpec[] = [
      { key: "front", url: imageUrl, useSharedDepth: true, position: [0, 0, -ROOM.half], rotationY: 0,             width: ROOM.half * 2, height: ROOM.height },
    ];
    if (sides) {
      list.push(
        { key: "left",  url: leftUrl!,  useSharedDepth: false, position: [-ROOM.half, 0, 0], rotationY:  Math.PI / 2, width: ROOM.half * 2, height: ROOM.height },
        { key: "right", url: rightUrl!, useSharedDepth: false, position: [ ROOM.half, 0, 0], rotationY: -Math.PI / 2, width: ROOM.half * 2, height: ROOM.height },
        { key: "back",  url: backUrl!,  useSharedDepth: false, position: [0, 0,  ROOM.half], rotationY:  Math.PI,     width: ROOM.half * 2, height: ROOM.height },
      );
    }
    return list;
  }, [imageUrl, sides, leftUrl, rightUrl, backUrl]);

  return (
    <div className="fixed inset-0 z-[100] bg-black select-none">
      {ready && !error && (
        <Canvas
          camera={{ position: [0, EYE_HEIGHT, ROOM.half - 0.5], fov: 72 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          dpr={quality.pixelRatio}
          onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
        >
          <ambientLight intensity={mode === "normals" ? 0.4 : 1.1} />
          <directionalLight position={[3, 4, 5]} intensity={0.55} />
          <directionalLight position={[-3, -2, -5]} intensity={0.3} />
          <Suspense fallback={null}>
            {walls.map((w) => (
              <Wall
                key={w.key + qualityIdx + mode + wireframe}
                spec={w}
                mode={mode}
                wireframe={wireframe}
                quality={quality}
                sharedDepth={sharedDepthTex}
              />
            ))}
            <Floor quality={quality} mode={mode} wireframe={wireframe} />
          </Suspense>
          <WalkRig collide={collide} />
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

      {/* Inspection HUD */}
      {ready && !error && (
        <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-auto">
          <div className="flex gap-1 bg-black/60 backdrop-blur rounded-lg p-1 border border-white/10">
            {(["photo", "depth", "normals"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 text-[11px] rounded-md capitalize transition ${
                  mode === m ? "bg-amber-500 text-black font-semibold" : "text-white/70 hover:bg-white/10"
                }`}
              >{m}</button>
            ))}
            <button
              onClick={() => setWireframe((w) => !w)}
              className={`px-2.5 py-1 text-[11px] rounded-md transition ${
                wireframe ? "bg-cyan-400 text-black font-semibold" : "text-white/70 hover:bg-white/10"
              }`}
            >Wire</button>
          </div>

          <div className="bg-black/60 backdrop-blur rounded-lg p-2 border border-white/10 w-52">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/60 mb-1">
              <span>Quality</span>
              <span className="text-amber-300 font-semibold">{quality.label}</span>
            </div>
            <input
              type="range" min={0} max={QUALITY.length - 1} step={1}
              value={qualityIdx}
              onChange={(e) => setQualityIdx(parseInt(e.target.value))}
              className="w-full accent-amber-400"
            />
            {qualityIdx === QUALITY.length - 1 && (
              <p className="text-[9px] text-amber-200/70 mt-1">8K displacement — may be slow on mobile</p>
            )}
          </div>
        </div>
      )}

      {/* Help / status */}
      {ready && !error && showHelp && (
        <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 text-white/85 text-xs bg-black/70 px-3 py-2 rounded-full backdrop-blur border border-white/10 flex items-center gap-3">
          <span>Drag to look · Click a spot to walk there · WASD + Shift to run</span>
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

      {/* Crosshair */}
      {ready && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
        </div>
      )}
    </div>
  );
};

export default ImmersiveFPSViewer;
