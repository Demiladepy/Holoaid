import React from "react";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";

export default function ThreeScene({ objects }) {
  return (
    <Canvas className="absolute top-0 left-0 w-full h-full pointer-events-none">
      <ambientLight intensity={0.5} />
      {objects.map((obj, i) => (
        <mesh key={i} position={[obj.box.x * 5, -obj.box.y * 5, -5]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="hotpink" emissive="blue" />
          <Html>
            <span className="text-white font-semibold">{obj.label}</span>
          </Html>
        </mesh>
      ))}
    </Canvas>
  );
}
