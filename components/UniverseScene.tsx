"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Connection, Memory } from "@/lib/types";
import { categoryColors } from "@/components/ui";

type Node = Memory & { position: [number, number, number] };

function seeded(seed: string) {
  let value = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 1);
  return () => { value = (value * 9301 + 49297) % 233280; return value / 233280; };
}

function buildNodes(memories: Memory[]): Node[] {
  const clusterMap = new Map<string, number>();
  memories.forEach((memory) => { const key = memory.projectId || memory.category; if (!clusterMap.has(key)) clusterMap.set(key, clusterMap.size); });
  return memories.map((memory, index) => {
    const random = seeded(memory.id);
    const cluster = clusterMap.get(memory.projectId || memory.category) || 0;
    const clusterAngle = (cluster / Math.max(clusterMap.size, 1)) * Math.PI * 2;
    const radius = 5.8 + random() * 7 + (index % 5) * .22;
    const angle = clusterAngle + (random() - .5) * .75;
    return { ...memory, position: [Math.cos(angle) * radius, (random() - .5) * 7, Math.sin(angle) * radius] };
  });
}

function BlackHole() {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => { if (group.current) group.current.rotation.z += delta * .08; if (inner.current) inner.current.rotation.z -= delta * .16; });
  return <group rotation={[1.15, .15, 0]}>
    <group ref={group}>
      <mesh><torusGeometry args={[2.1, .34, 20, 160]} /><meshBasicMaterial color="#b86c1e" transparent opacity={.5} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      <mesh rotation={[0, 0, .4]}><torusGeometry args={[2.45, .13, 10, 160]} /><meshBasicMaterial color="#ffd275" transparent opacity={.7} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      <mesh rotation={[0, 0, -.3]}><torusGeometry args={[2.8, .055, 8, 160]} /><meshBasicMaterial color="#e59a38" transparent opacity={.42} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    </group>
    <mesh ref={inner}><ringGeometry args={[1.15, 1.8, 160]} /><meshBasicMaterial color="#f2aa43" transparent opacity={.3} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    <mesh rotation={[-1.15, -.15, 0]}><sphereGeometry args={[1.3, 48, 48]} /><meshBasicMaterial color="#000000" /></mesh>
    <pointLight color="#f5b448" intensity={34} distance={14} decay={2} />
  </group>;
}

function Dust() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(1200 * 3);
    const random = seeded("cosmic-dust");
    for (let index = 0; index < 1200; index += 1) {
      const radius = 8 + random() * 35;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.cos(phi) * .5;
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const output = new THREE.BufferGeometry(); output.setAttribute("position", new THREE.BufferAttribute(positions, 3)); return output;
  }, []);
  return <points geometry={geometry}><pointsMaterial color="#d7c8a3" size={.025} transparent opacity={.35} sizeAttenuation /></points>;
}

function MemoryGraph({ nodes, connections, onSelect }: { nodes: Node[]; connections: Connection[]; onSelect: (memory: Memory) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const linePositions = useMemo(() => {
    const values: number[] = [];
    for (const connection of connections) {
      const source = nodeMap.get(connection.sourceId); const target = nodeMap.get(connection.targetId);
      if (source && target) values.push(...source.position, ...target.position);
    }
    return new Float32Array(values);
  }, [connections, nodeMap]);
  return <>
    <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[linePositions, 3]} /></bufferGeometry><lineBasicMaterial color="#a67939" transparent opacity={.18} /></lineSegments>
    {nodes.map((node) => {
      const active = hovered === node.id;
      const color = categoryColors[node.category];
      return <group key={node.id} position={node.position}>
        <mesh onClick={(event) => { event.stopPropagation(); onSelect(node); }} onPointerOver={(event) => { event.stopPropagation(); setHovered(node.id); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHovered(null); document.body.style.cursor = "auto"; }} scale={active ? 1.65 : 1}>
          <sphereGeometry args={[.12, 12, 12]} /><meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <sprite scale={[active ? 1.2 : .55, active ? 1.2 : .55, 1]}><spriteMaterial color={color} transparent opacity={active ? .28 : .12} blending={THREE.AdditiveBlending} depthWrite={false} /></sprite>
      </group>;
    })}
  </>;
}

export default function UniverseScene({ memories, connections, onSelect }: { memories: Memory[]; connections: Connection[]; onSelect: (memory: Memory) => void }) {
  const nodes = useMemo(() => buildNodes(memories), [memories]);
  return <Canvas camera={{ position: [0, 7, 17], fov: 55 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true }}>
    <color attach="background" args={["#050403"]} /><fog attach="fog" args={["#050403", 18, 45]} /><ambientLight intensity={.08} />
    <Dust /><BlackHole /><MemoryGraph nodes={nodes} connections={connections} onSelect={onSelect} />
    <OrbitControls makeDefault enableDamping dampingFactor={.045} minDistance={7} maxDistance={32} autoRotate autoRotateSpeed={.22} />
  </Canvas>;
}

