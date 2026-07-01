import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * ImmersiveFPSViewer — walk-in 3D view of the generated photo.
 * Now with wall-sliding collision, click-to-walk marker, and debug overlay.
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
  { label: "Fast",     segments: 100, texSize: 512,  pixelRatio: 1 },
  { label: "Balanced", segments: 200, texSize: 1024, pixelRatio: 1.5 },
  { label: "High",     segments: 400, texSize: 2048, pixelRatio: 2 },
  { label: "8K",       segments: 700, texSize: 4096, pixelRatio: Math.min(window.devicePixelRatio || 2, 3) },
];

const ROOM = { half: 4, height: 4.5 };
const EYE_HEIGHT = -0.6;
const WALK_SPEED = 1.6;
const RUN_MULT = 2.2;
const CAPSULE_RADIUS = 0.32;
const SKIN = 0.02;
const DISPLACEMENT_SCALE = 1.4;

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
        wireframe, side: THREE.DoubleSide,
        displacementMap: displacement || undefined, displacementScale: -DISPLACEMENT_SCALE,
      });
    }
    if (mode === "depth") {
      return new THREE.MeshStandardMaterial({
        map: displacement || tex, wireframe, side: THREE.DoubleSide,
        displacementMap: displacement || undefined, displacementScale: -DISPLACEMENT_SCALE,
        roughness: 1, metalness: 0,
      });
    }
    return new THREE.MeshStandardMaterial({
      map: tex, wireframe, side: THREE.DoubleSide,
      displacementMap: displacement || undefined, displacementScale: -DISPLACEMENT_SCALE,
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
      wireframe, side: THREE.DoubleSide, roughness: 1,
    });
  }, [mode, wireframe]);
  return (
    <mesh position={[0, -ROOM.height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[ROOM.half * 2, ROOM.half * 2, Math.max(1, quality.segments / 8), Math.max(1, quality.segments / 8)]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Full 360° skydome — wraps the entire realm around the viewer (inward-facing sphere). */
function Skydome({ url, mode, wireframe }: { url: string; mode: ViewMode; wireframe: boolean }) {
  const tex = useLoader(THREE.TextureLoader, url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = useMemo(() => {
    if (mode === "normals") return new THREE.MeshNormalMaterial({ wireframe, side: THREE.BackSide });
    return new THREE.MeshBasicMaterial({ map: tex, wireframe, side: THREE.BackSide, toneMapped: true });
  }, [mode, wireframe, tex]);
  return (
    <mesh rotation={[0, Math.PI, 0]} renderOrder={-1}>
      <sphereGeometry args={[50, 96, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** For each wall, compute how far the displaced surface intrudes inward at (x,z), and the inward normal. */
type WallDir = "front" | "back" | "left" | "right";
interface Intrusion { dir: WallDir; dist: number; normal: THREE.Vector3 }

function wallIntrusions(hf: Heightfield | null, x: number, z: number): Intrusion[] {
  const v = 0.5; // eye-level slice
  const list: Intrusion[] = [];
  // Front wall at z = -half, inward normal (0,0,+1)
  {
    const u = (x + ROOM.half) / (ROOM.half * 2);
    const intr = sampleHeight(hf, u, v) * DISPLACEMENT_SCALE;
    list.push({ dir: "front", dist: z - (-ROOM.half + intr), normal: new THREE.Vector3(0, 0, 1) });
  }
  // Back wall at z = +half, inward normal (0,0,-1)
  {
    const u = 1 - (x + ROOM.half) / (ROOM.half * 2);
    const intr = sampleHeight(hf, u, v) * DISPLACEMENT_SCALE;
    list.push({ dir: "back", dist: (ROOM.half - intr) - z, normal: new THREE.Vector3(0, 0, -1) });
  }
  // Left wall at x = -half, inward normal (+1,0,0)
  {
    const u = 1 - (z + ROOM.half) / (ROOM.half * 2);
    const intr = sampleHeight(hf, u, v) * DISPLACEMENT_SCALE;
    list.push({ dir: "left", dist: x - (-ROOM.half + intr), normal: new THREE.Vector3(1, 0, 0) });
  }
  // Right wall at x = +half, inward normal (-1,0,0)
  {
    const u = (z + ROOM.half) / (ROOM.half * 2);
    const intr = sampleHeight(hf, u, v) * DISPLACEMENT_SCALE;
    list.push({ dir: "right", dist: (ROOM.half - intr) - x, normal: new THREE.Vector3(-1, 0, 0) });
  }
  return list;
}

/** Resolve capsule position against wall intrusions with sliding + depenetration. */
function resolveCollision(hf: Heightfield | null, x: number, z: number): { x: number; z: number; hits: Intrusion[] } {
  let px = x, pz = z;
  const hits: Intrusion[] = [];
  for (let i = 0; i < 3; i++) {
    const list = wallIntrusions(hf, px, pz);
    let worst: Intrusion | null = null;
    for (const w of list) {
      const penetration = CAPSULE_RADIUS + SKIN - w.dist;
      if (penetration > 0 && (!worst || penetration > (CAPSULE_RADIUS + SKIN - worst.dist))) {
        worst = w;
      }
    }
    if (!worst) break;
    const pen = CAPSULE_RADIUS + SKIN - worst.dist;
    px += worst.normal.x * pen;
    pz += worst.normal.z * pen;
    hits.push(worst);
  }
  return { x: px, z: pz, hits };
}

interface DebugStats {
  fps: number;
  pos: THREE.Vector3;
  target: THREE.Vector3 | null;
  hits: number;
}

/** Drag-to-look + click-to-walk + WASD with sliding collision. */
function WalkRig({
  hfRef, onDebug, onMarker, showDebug,
}: {
  hfRef: React.MutableRefObject<Heightfield | null>;
  onDebug: (s: DebugStats) => void;
  onMarker: (p: THREE.Vector3) => void;
  showDebug: boolean;
}) {
  const { camera, gl, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(0);
  const pitch = useRef(0);
  const target = useRef<THREE.Vector3 | null>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const fpsAcc = useRef({ t: 0, n: 0, fps: 60 });
  const rayHelperRef = useRef<THREE.ArrowHelper | null>(null);
  const capsuleRef = useRef<THREE.Mesh | null>(null);

  // Debug meshes
  useEffect(() => {
    if (!showDebug) return;
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0,0,-1), camera.position, 1, 0xffcc00, 0.15, 0.08);
    scene.add(arrow);
    rayHelperRef.current = arrow;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(CAPSULE_RADIUS, CAPSULE_RADIUS, 1.6, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x22ffaa, wireframe: true, transparent: true, opacity: 0.55 }),
    );
    scene.add(cap);
    capsuleRef.current = cap;
    return () => {
      scene.remove(arrow); arrow.dispose();
      scene.remove(cap); cap.geometry.dispose(); (cap.material as THREE.Material).dispose();
      rayHelperRef.current = null; capsuleRef.current = null;
    };
  }, [showDebug, scene, camera]);

  useEffect(() => {
    camera.position.set(0, EYE_HEIGHT, ROOM.half - 0.5);
    const dn = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [camera]);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    let dragging = false;
    let lastX = 0, lastY = 0, downX = 0, downY = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
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
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist < 5) {
        const rect = el.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), ROOM.height / 2);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, hit)) {
          target.current = hit.clone();
          onMarker(hit.clone());
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
  }, [gl, camera, onMarker]);

  useFrame((_, delta) => {
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

    if (dir.lengthSq() === 0 && target.current) {
      const dxT = target.current.x - camera.position.x;
      const dzT = target.current.z - camera.position.z;
      const dLen = Math.hypot(dxT, dzT);
      if (dLen < 0.18) {
        target.current = null;
      } else {
        dir.set(dxT / dLen, 0, dzT / dLen);
      }
    } else if (dir.lengthSq() > 0) {
      target.current = null;
    }

    let hitsCount = 0;
    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(speed);
      // Attempt full movement, then depenetrate against walls (gives sliding).
      const desiredX = camera.position.x + dir.x;
      const desiredZ = camera.position.z + dir.z;
      const clampedX = Math.max(-ROOM.half + 0.1, Math.min(ROOM.half - 0.1, desiredX));
      const clampedZ = Math.max(-ROOM.half + 0.1, Math.min(ROOM.half - 0.1, desiredZ));
      const res = resolveCollision(hfRef.current, clampedX, clampedZ);
      hitsCount = res.hits.length;
      // If stuck (no progress toward click target), abandon target.
      if (target.current) {
        const before = Math.hypot(target.current.x - camera.position.x, target.current.z - camera.position.z);
        const after  = Math.hypot(target.current.x - res.x, target.current.z - res.z);
        if (before - after < speed * 0.15) target.current = null;
      }
      camera.position.x = res.x;
      camera.position.z = res.z;
    }
    camera.position.y = EYE_HEIGHT;

    // FPS
    const acc = fpsAcc.current;
    acc.t += delta; acc.n += 1;
    if (acc.t >= 0.5) { acc.fps = acc.n / acc.t; acc.t = 0; acc.n = 0; }

    // Debug helpers
    if (rayHelperRef.current) {
      rayHelperRef.current.position.copy(camera.position);
      rayHelperRef.current.setDirection(fwd);
      rayHelperRef.current.setLength(2.5, 0.2, 0.1);
    }
    if (capsuleRef.current) {
      capsuleRef.current.position.set(camera.position.x, camera.position.y - 0.2, camera.position.z);
    }

    onDebug({ fps: acc.fps, pos: camera.position.clone(), target: target.current ? target.current.clone() : null, hits: hitsCount });
  });

  return null;
}

/** Fading ring at click destination. */
function DestinationMarker({ marker }: { marker: { pos: THREE.Vector3; born: number } | null }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current || !marker) return;
    const age = (performance.now() - marker.born) / 1000;
    const life = 1.6;
    const t = Math.min(1, age / life);
    const s = 0.4 + t * 0.8;
    ref.current.scale.set(s, s, s);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t);
  });
  if (!marker) return null;
  return (
    <mesh ref={ref} position={[marker.pos.x, -ROOM.height / 2 + 0.01, marker.pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.18, 0.28, 32]} />
      <meshBasicMaterial color={0xffc857} transparent opacity={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

const ImmersiveFPSViewer = ({ imageUrl, depthUrl, leftUrl, rightUrl, backUrl, onExit }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<ViewMode>("photo");
  const [wireframe, setWireframe] = useState(false);
  const [qualityIdx, setQualityIdx] = useState(1);
  const [showHelp, setShowHelp] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [debug, setDebug] = useState<DebugStats>({ fps: 0, pos: new THREE.Vector3(), target: null, hits: 0 });
  const [marker, setMarker] = useState<{ pos: THREE.Vector3; born: number } | null>(null);

  const quality = QUALITY[qualityIdx];

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

  const heightfield = useRef<Heightfield | null>(null);
  const [sharedDepthTex, setSharedDepthTex] = useState<THREE.Texture | null>(null);

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

  const sides = leftUrl && rightUrl && backUrl;
  const walls: WallSpec[] = useMemo(() => {
    const list: WallSpec[] = [
      { key: "front", url: imageUrl, useSharedDepth: true, position: [0, 0, -ROOM.half], rotationY: 0, width: ROOM.half * 2, height: ROOM.height },
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
                spec={w} mode={mode} wireframe={wireframe} quality={quality}
                sharedDepth={sharedDepthTex}
              />
            ))}
            <Floor quality={quality} mode={mode} wireframe={wireframe} />
            <DestinationMarker marker={marker} />
          </Suspense>
          <WalkRig
            hfRef={heightfield}
            onDebug={setDebug}
            onMarker={(p) => setMarker({ pos: p, born: performance.now() })}
            showDebug={showDebug}
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
            <button
              onClick={() => setShowDebug((v) => !v)}
              className={`px-2.5 py-1 text-[11px] rounded-md transition ${
                showDebug ? "bg-emerald-400 text-black font-semibold" : "text-white/70 hover:bg-white/10"
              }`}
            >Debug</button>
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

          {showDebug && (
            <div className="bg-black/70 backdrop-blur rounded-lg p-2 border border-emerald-400/40 w-52 font-mono text-[10px] text-emerald-200 space-y-0.5">
              <div className="flex justify-between"><span>FPS</span><span className={debug.fps < 30 ? "text-red-300" : "text-emerald-200"}>{debug.fps.toFixed(0)}</span></div>
              <div className="flex justify-between"><span>Quality</span><span>{quality.label}</span></div>
              <div className="flex justify-between"><span>Segments</span><span>{quality.segments}</span></div>
              <div className="flex justify-between"><span>Tex</span><span>{quality.texSize}px</span></div>
              <div className="flex justify-between"><span>DPR</span><span>{quality.pixelRatio}</span></div>
              <div className="border-t border-white/10 my-1" />
              <div className="flex justify-between"><span>Pos</span><span>{debug.pos.x.toFixed(2)}, {debug.pos.z.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Capsule r</span><span>{CAPSULE_RADIUS.toFixed(2)}m</span></div>
              <div className="flex justify-between"><span>Wall hits</span><span className={debug.hits > 0 ? "text-amber-300" : ""}>{debug.hits}</span></div>
              <div className="flex justify-between"><span>Target</span><span>{debug.target ? `${debug.target.x.toFixed(1)}, ${debug.target.z.toFixed(1)}` : "—"}</span></div>
            </div>
          )}
        </div>
      )}

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

      {ready && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
        </div>
      )}
    </div>
  );
};

export default ImmersiveFPSViewer;
