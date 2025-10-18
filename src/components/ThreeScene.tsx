import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

type DetectedObj = {
  bbox: [number, number, number, number]; // normalized bbox center [x, y, w, h]
  class: string;
  score?: number;
};

function FloatingTorus() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.2;
    ref.current.rotation.y += delta * 0.35;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.2;
  });

  return (
    <mesh ref={ref} position={[0, 0.8, -2]}>
      <torusGeometry args={[0.8, 0.25, 24, 64]} />
      <meshStandardMaterial
        color={new THREE.Color('#00ffd5')}
        emissive={new THREE.Color('#00ffd5')}
        metalness={0.3}
        roughness={0.1}
      />
    </mesh>
  );
}

function HoloBox({
  x,
  y,
  label,
  score,
}: {
  x: number;
  y: number;
  label: string;
  score?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.2 + x) * 0.4;
  });

  const pos = useMemo(() => [x * 2.5, -y * 1.8, -2.5] as [number, number, number], [x, y]);

  return (
    <mesh ref={ref} position={pos}>
      <boxGeometry args={[0.35, 0.25, 0.15]} />
      <meshStandardMaterial color="#00ffa5" emissive="#007f5f" metalness={0.2} roughness={0.3} />
      {/* 🔹 Visual Debug Overlay */}
      <Html center distanceFactor={6} transform occlude>
        <div className="px-2 py-1 bg-black/70 text-xs text-white rounded-md backdrop-blur-sm border border-white/10">
          <strong>{label}</strong>
          {score && <div>({(score * 100).toFixed(1)}%)</div>}
          <small className="text-gray-300">x:{x.toFixed(2)} y:{y.toFixed(2)}</small>
        </div>
      </Html>
    </mesh>
  );
}

function OverlayScene({ objects = [] }: { objects?: DetectedObj[] }) {
  const { gl } = useThree();

  useEffect(() => {
    // Ensure renderer background is transparent so underlying video shows through
    gl.setClearColor(new THREE.Color(0x000000), 0);
  }, [gl]);

  // 🔹 Log objects to console whenever they change
  useEffect(() => {
    if (objects && objects.length > 0) {
      console.group('🎯 Detected Objects');
      objects.forEach((o, i) => {
        console.log(`#${i + 1}:`, {
          class: o.class,
          score: o.score?.toFixed(2),
          bbox: o.bbox,
        });
      });
      console.groupEnd();
    }
  }, [objects]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <pointLight position={[-5, -5, -5]} intensity={0.2} />

  <FloatingTorus />
  <Stars radius={20} depth={10} count={60} factor={2} saturation={0.1} fade />

      {/* 🔹 Safe map to render boxes */}
      {(objects ?? []).map((o, i) => {
        const [x, y] = o.bbox;
        const nx = (x - 0.5) * 2;
        const ny = (y - 0.5) * 2;
        return <HoloBox key={i} x={nx} y={ny} label={o.class} score={o.score} />;
      })}

      <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} />
    </>
  );
}

export default function ThreeScene({ objects = [], onReady }: { objects?: DetectedObj[]; onReady?: () => void }) {
  // debug
  useEffect(() => {
    console.log('ThreeScene mounted. objects:', objects?.length ?? 0);
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Canvas
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      camera={{ fov: 50, position: [0, 0, 5] }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), 0)}
    >
      <OverlayScene objects={objects} />
    </Canvas>
  );
}
