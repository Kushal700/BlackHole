"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Connection, Memory } from "@/lib/types";
import { categoryColors } from "@/components/ui";
import { isSkillMemory, skillActivityStrength } from "@/lib/skill-activity";

type VisualNode = {
  id: string;
  memory: Memory;
  position: [number, number, number];
  primary: boolean;
  scale: number;
};

type VisualCluster = {
  id: string;
  label: string;
  position: [number, number, number];
  count: number;
};

function seeded(seed: string) {
  let value = [...seed].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    1,
  );
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function classifyMemory(memory: Memory) {
  const signal = `${memory.title} ${memory.tags.join(" ")}`.toLowerCase();
  const robloxKnowledge =
    memory.tags.includes("roblox") ||
    memory.projectId?.toLowerCase().includes("roblox");
  if (robloxKnowledge) {
    if (/network|security|remote|server.author|exploit/.test(signal))
      return { id: "roblox-security", label: "Networking & security" };
    if (/luau|coding|architecture|state machine|package/.test(signal))
      return { id: "roblox-code", label: "Luau & architecture" };
    if (/item|inventory|economy|craft|loot|shop|trade/.test(signal))
      return { id: "roblox-economy", label: "Items & economy" };
    if (/combat|action rpg|boss|enemy|npc| ai /.test(` ${signal} `))
      return { id: "roblox-gameplay", label: "Combat & gameplay" };
    if (/3d|blender|model|mesh|topology|texture|uv|asset/.test(signal))
      return { id: "roblox-assets", label: "3D assets" };
    if (/animat|rigg|skin|ik|fk|armature/.test(signal))
      return { id: "roblox-animation", label: "Animation & rigging" };
    if (/vfx|particle|beam|trail|lighting|shader/.test(signal))
      return { id: "roblox-vfx", label: "VFX & lighting" };
    if (/ ui | ux |interface|hud|menu/.test(` ${signal} `))
      return { id: "roblox-ui", label: "UI & UX" };
    if (/world|terrain|audio|camera|environment|level/.test(signal))
      return { id: "roblox-world", label: "World, audio & camera" };
    if (/qa|test|performance|profil|liveops|publish/.test(signal))
      return { id: "roblox-operations", label: "QA & live operations" };
    return { id: "roblox-foundations", label: "Roblox foundations" };
  }
  if (memory.tags.includes("skill")) {
    if (/youtube|vidiq|video|descript/.test(signal))
      return { id: "skill-media", label: "Media skills" };
    if (/spreadsheet|excel|document|pdf|presentation|page/.test(signal))
      return { id: "skill-documents", label: "Document skills" };
    if (/browser|chrome|computer|cloud|site|hosting|automation/.test(signal))
      return { id: "skill-automation", label: "Web & automation" };
    if (/image|visual|design|pet/.test(signal))
      return { id: "skill-creative", label: "Creative skills" };
    if (/openai|plugin|skill creator|skill installer|review agent/.test(signal))
      return { id: "skill-system", label: "Codex system" };
    return { id: "skill-general", label: "General skills" };
  }
  if (memory.projectId?.toLowerCase().includes("blackhole"))
    return { id: "project-blackhole", label: "BlackHole project" };
  return {
    id: `memory-${memory.category}`,
    label: `${memory.category[0].toUpperCase()}${memory.category.slice(1)} memories`,
  };
}

function buildNodes(memories: Memory[]) {
  const nodes: VisualNode[] = [];
  const clusters: VisualCluster[] = [];
  const grouped = new Map<string, { label: string; memories: Memory[] }>();
  for (const memory of memories) {
    const group = classifyMemory(memory);
    const current = grouped.get(group.id) || {
      label: group.label,
      memories: [],
    };
    current.memories.push(memory);
    grouped.set(group.id, current);
  }

  const groups = [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const groupCount = Math.max(groups.length, 1);
  groups.forEach(([groupId, group], groupIndex) => {
    const orbit = (groupIndex / groupCount) * Math.PI * 2 - Math.PI / 2;
    const ring = 6.4 + (groupIndex % 2) * 1.45;
    const anchor: [number, number, number] = [
      Math.cos(orbit) * ring * 1.22,
      Math.sin(orbit) * ring * 0.78 - 0.35,
      -1.2 + ((groupIndex % 3) - 1) * 0.8,
    ];
    clusters.push({
      id: groupId,
      label: group.label,
      position: anchor,
      count: group.memories.length,
    });

    group.memories.forEach((memory, memoryIndex) => {
      const random = seeded(memory.id);
      const memberAngle = memoryIndex * 2.3999632297 + random() * 0.45;
      const memberRadius =
        memoryIndex === 0 ? 0 : 0.52 + Math.sqrt(memoryIndex) * 0.38;
      const center: [number, number, number] = [
        anchor[0] + Math.cos(memberAngle) * memberRadius * 1.22,
        anchor[1] + Math.sin(memberAngle) * memberRadius * 0.82,
        anchor[2] + (random() - 0.5) * 2.2,
      ];
      nodes.push({
        id: `${memory.id}-primary`,
        memory,
        position: center,
        primary: true,
        scale: memories.length > 35 ? 1.5 : 1.85,
      });

      const fragments =
        memories.length > 60
          ? 4
          : memories.length > 30
            ? 7
            : Math.min(
                18,
                Math.max(9, Math.round(memory.content.length / 180)),
              );
      for (
        let fragmentIndex = 0;
        fragmentIndex < fragments;
        fragmentIndex += 1
      ) {
        const angle = random() * Math.PI * 2;
        const radius =
          0.14 +
          Math.pow(random(), 0.72) * (memories.length > 35 ? 0.72 : 1.15);
        nodes.push({
          id: `${memory.id}-${fragmentIndex}`,
          memory,
          position: [
            center[0] + Math.cos(angle) * radius,
            center[1] + Math.sin(angle) * radius * 0.78,
            center[2] + (random() - 0.5) * radius,
          ],
          primary: false,
          scale: 0.28 + random() * 0.46,
        });
      }
    });
  });
  return { nodes, clusters };
}

function AccretionDisk() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, delta) => {
    if (material.current) material.current.uniforms.uTime.value += delta;
  });
  return (
    <mesh rotation={[0, 0, -0.08]}>
      <planeGeometry args={[6.2, 6.2, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - .5;
            float r = length(p) * 2.0;
            float a = atan(p.y, p.x);
            if (r < .28 || r > .93) discard;
            float inner = smoothstep(.28, .37, r);
            float outer = 1.0 - smoothstep(.58, .93, r);
            float streaks = .58 + .42 * sin(a * 18.0 - uTime * 2.4 + r * 38.0);
            float fine = .72 + .28 * sin(a * 47.0 + uTime * 1.3 - r * 91.0);
            float hot = 1.0 - smoothstep(.28, .64, r);
            vec3 amber = vec3(1.0, .42, .07);
            vec3 whiteHot = vec3(1.0, .93, .72);
            vec3 color = mix(amber, whiteHot, hot) * (1.15 + hot * 2.2);
            float alpha = inner * outer * (.25 + streaks * fine * .7);
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  );
}

function BlackHole() {
  const rings = useRef<THREE.Group>(null);
  const glowTexture = useMemo(() => createGlowTexture(), []);
  useFrame((_, delta) => {
    if (rings.current) rings.current.rotation.z += delta * 0.055;
  });
  return (
    <group position={[0, -0.65, 0]}>
      <group ref={rings} rotation={[1.31, 0.08, 0]}>
        <AccretionDisk />
        <mesh>
          <torusGeometry args={[1.08, 0.055, 14, 180]} />
          <meshBasicMaterial
            color="#fff6d4"
            transparent
            opacity={0.96}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[0, 0, 0.22]}>
          <torusGeometry args={[1.52, 0.035, 10, 180]} />
          <meshBasicMaterial
            color="#ffc360"
            transparent
            opacity={0.54}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[0, 0, -0.36]}>
          <torusGeometry args={[2.08, 0.018, 8, 180]} />
          <meshBasicMaterial
            color="#ba7027"
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh scale={[1.34, 1.34, 1.34]}>
        <sphereGeometry args={[0.64, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh rotation={[0, 0, 0.04]}>
        <torusGeometry args={[0.91, 0.065, 12, 160]} />
        <meshBasicMaterial
          color="#fff4c7"
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -0.3]}>
        <planeGeometry args={[5.3, 0.022]} />
        <meshBasicMaterial
          color="#fff6df"
          transparent
          opacity={0.84}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <sprite scale={[4.4, 4.4, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#d78a2f"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <pointLight color="#ffb04c" intensity={48} distance={11} decay={2.1} />
    </group>
  );
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,.72)");
  gradient.addColorStop(0.48, "rgba(255,255,255,.16)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createNebulaTexture(seed: string) {
  const random = seeded(seed);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, 512, 512);
  for (let index = 0; index < 70; index += 1) {
    const x = random() * 512;
    const y = random() * 512;
    const radius = 28 + random() * 110;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    const brightness = Math.round(50 + random() * 70);
    gradient.addColorStop(
      0,
      `rgba(${brightness}, ${brightness}, ${brightness + 6}, ${0.025 + random() * 0.055})`,
    );
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Nebula() {
  const textureA = useMemo(() => createNebulaTexture("nebula-a"), []);
  const textureB = useMemo(() => createNebulaTexture("nebula-b"), []);
  return (
    <group>
      <sprite position={[-5.7, -0.8, -6]} scale={[14, 18, 1]}>
        <spriteMaterial
          map={textureA}
          color="#9fa3ad"
          transparent
          opacity={0.34}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite position={[5.1, 1.8, -7]} scale={[16, 20, 1]}>
        <spriteMaterial
          map={textureB}
          color="#746f70"
          transparent
          opacity={0.26}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite position={[0, -5.5, -8]} scale={[13, 9, 1]}>
        <spriteMaterial
          map={textureA}
          color="#514a44"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

function Dust() {
  const geometry = useMemo(() => {
    const count = 3600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const random = seeded("memory-dust-v2");
    for (let index = 0; index < count; index += 1) {
      const close = index < 2600;
      positions[index * 3] = (random() - 0.5) * (close ? 15 : 42);
      positions[index * 3 + 1] = (random() - 0.5) * (close ? 23 : 36);
      positions[index * 3 + 2] =
        (random() - 0.5) * (close ? 11 : 34) - (close ? 1 : 6);
      const warmth = random();
      colors[index * 3] = 0.56 + warmth * 0.34;
      colors[index * 3 + 1] = 0.54 + warmth * 0.22;
      colors[index * 3 + 2] = 0.52 + warmth * 0.08;
    }
    const output = new THREE.BufferGeometry();
    output.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    output.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return output;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.025}
        transparent
        opacity={0.68}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function OrbitalArcs() {
  const glowTexture = useMemo(() => createGlowTexture(), []);
  const arcs = useMemo(
    () =>
      [
        { rx: 8.4, ry: 11.5, start: 0.55, end: 2.1, rotation: 0.08 },
        { rx: 7.2, ry: 10.2, start: 3.42, end: 5.2, rotation: -0.13 },
        { rx: 10.1, ry: 8.8, start: 2.55, end: 3.88, rotation: 0.36 },
        { rx: 9.4, ry: 12.8, start: 5.18, end: 6.12, rotation: -0.28 },
        { rx: 6.1, ry: 9.6, start: 0.12, end: 0.92, rotation: 0.2 },
      ].map((definition) => {
        const curve = new THREE.EllipseCurve(
          0,
          0,
          definition.rx,
          definition.ry,
          definition.start,
          definition.end,
          false,
          definition.rotation,
        );
        const points = curve
          .getPoints(100)
          .map((point) => new THREE.Vector3(point.x, point.y, -3.5));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: "#b9aa92",
          transparent: true,
          opacity: 0.24,
        });
        return {
          line: new THREE.Line(geometry, material),
          beacon: points.at(-1)!,
        };
      }),
    [],
  );
  return (
    <group>
      {arcs.map((arc, index) => (
        <group key={index}>
          <primitive object={arc.line} />
          <mesh position={arc.beacon}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshBasicMaterial color="#fff4d6" toneMapped={false} />
          </mesh>
          <sprite position={arc.beacon} scale={[0.65, 0.65, 1]}>
            <spriteMaterial
              map={glowTexture}
              color="#fff4d6"
              transparent
              opacity={0.48}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        </group>
      ))}
    </group>
  );
}

function ActiveSkillGlow({
  node,
  texture,
}: {
  node: VisualNode;
  texture: THREE.Texture;
}) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const phase = useMemo(
    () => seeded(node.memory.id)() * Math.PI * 2,
    [node.memory.id],
  );
  useFrame(({ clock }) => {
    const strength = skillActivityStrength(node.memory);
    const pulse = (Math.sin(clock.elapsedTime * 4.2 + phase) + 1) / 2;
    const scale = 0.9 + strength * (0.32 + pulse * 0.32);
    if (group.current) {
      group.current.scale.setScalar(scale);
      group.current.rotation.z += 0.008;
    }
    if (halo.current) halo.current.opacity = strength * (0.52 + pulse * 0.34);
    if (ring.current) ring.current.opacity = strength * (0.42 + pulse * 0.38);
  });
  return (
    <group ref={group} position={node.position}>
      <sprite scale={[1.75, 1.75, 1]}>
        <spriteMaterial
          ref={halo}
          map={texture}
          color="#fff2ba"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <mesh>
        <ringGeometry args={[0.16, 0.23, 32]} />
        <meshBasicMaterial
          ref={ring}
          color="#ffe09a"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#ffd27a" intensity={9} distance={2.4} decay={2} />
      <Html
        position={[0, 0.34, 0]}
        center
        distanceFactor={12}
        style={{ pointerEvents: "none" }}
      >
        <div className="whitespace-nowrap rounded-full border border-amber-100/25 bg-black/75 px-2 py-1 text-[7px] font-bold uppercase tracking-[.18em] text-amber-100 shadow-[0_0_18px_#eaa33b55] backdrop-blur-md">
          Skill active
        </div>
      </Html>
    </group>
  );
}

function MemoryGraph({
  nodes,
  clusters,
  connections,
  onSelect,
}: {
  nodes: VisualNode[];
  clusters: VisualCluster[];
  connections: Connection[];
  onSelect: (memory: Memory) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const glowTexture = useMemo(() => createGlowTexture(), []);
  const primaryNodes = useMemo(
    () => nodes.filter((node) => node.primary),
    [nodes],
  );
  const primaryMap = useMemo(
    () => new Map(primaryNodes.map((node) => [node.memory.id, node])),
    [primaryNodes],
  );
  const hoveredNode = hovered === null ? undefined : nodes[hovered];
  const hoveredPrimary = hoveredNode
    ? primaryMap.get(hoveredNode.memory.id)
    : undefined;
  const linePositions = useMemo(() => {
    const values: number[] = [];
    nodes.forEach((node, index) => {
      if (node.primary || index % 2 !== 0) return;
      const primary = primaryMap.get(node.memory.id);
      if (primary) values.push(...primary.position, ...node.position);
    });
    const calmConnections =
      primaryNodes.length <= 30
        ? connections
        : hoveredNode
          ? connections.filter(
              (connection) =>
                connection.sourceId === hoveredNode.memory.id ||
                connection.targetId === hoveredNode.memory.id,
            )
          : [...connections]
              .sort((left, right) => right.score - left.score)
              .slice(0, 28);
    for (const connection of calmConnections) {
      const source = primaryMap.get(connection.sourceId);
      const target = primaryMap.get(connection.targetId);
      if (source && target) values.push(...source.position, ...target.position);
    }
    return new Float32Array(values);
  }, [connections, hoveredNode, nodes, primaryMap, primaryNodes.length]);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const memoryWhite = new THREE.Color("#e9ddc4");
    nodes.forEach((node, index) => {
      const highlightedMemory =
        hovered === null || nodes[hovered]?.memory.id === node.memory.id;
      const scale =
        node.scale * (highlightedMemory && hovered !== null ? 1.55 : 1);
      matrix.compose(
        new THREE.Vector3(...node.position),
        new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale),
      );
      mesh.current!.setMatrixAt(index, matrix);
      color.set(
        node.memory.tags.includes("skill")
          ? "#edc06a"
          : categoryColors[node.memory.category],
      );
      color.lerp(memoryWhite, 0.72);
      if (!highlightedMemory) color.multiplyScalar(0.32);
      mesh.current!.setColorAt(index, color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
  }, [hovered, nodes]);

  function move(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    setHovered(event.instanceId ?? null);
    document.body.style.cursor = "pointer";
  }
  function leave() {
    setHovered(null);
    document.body.style.cursor = "auto";
  }
  function click(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    const node =
      event.instanceId === undefined ? undefined : nodes[event.instanceId];
    if (node) onSelect(node.memory);
  }

  return (
    <>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#998d7e"
          transparent
          opacity={hovered === null ? 0.14 : 0.08}
        />
      </lineSegments>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, nodes.length]}
        onPointerMove={move}
        onPointerOut={leave}
        onClick={click}
      >
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {primaryNodes.map((node) => (
        <group key={node.id} position={node.position}>
          <sprite scale={[0.82, 0.82, 1]}>
            <spriteMaterial
              map={glowTexture}
              color={
                node.memory.tags.includes("skill")
                  ? "#edc06a"
                  : categoryColors[node.memory.category]
              }
              transparent
              opacity={0.33}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
          {primaryNodes.length <= 14 && (
            <Html center distanceFactor={13} style={{ pointerEvents: "none" }}>
              <div className="whitespace-nowrap rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[8px] tracking-wide text-[#d4cec2] backdrop-blur-md">
                {node.memory.title}
              </div>
            </Html>
          )}
        </group>
      ))}
      {primaryNodes
        .filter(
          (node) =>
            isSkillMemory(node.memory) &&
            skillActivityStrength(node.memory) > 0,
        )
        .map((node) => (
          <ActiveSkillGlow
            key={`active-${node.id}`}
            node={node}
            texture={glowTexture}
          />
        ))}
      {primaryNodes.length > 14 &&
        clusters.map((cluster) => (
          <Html
            key={cluster.id}
            position={cluster.position}
            center
            distanceFactor={15}
            style={{ pointerEvents: "none" }}
          >
            <div className="whitespace-nowrap rounded-full border border-amber-100/10 bg-black/45 px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[.14em] text-amber-50/45 backdrop-blur-md">
              {cluster.label}
              <span className="ml-2 text-amber-100/25">{cluster.count}</span>
            </div>
          </Html>
        ))}
      {primaryNodes.length > 14 && hoveredPrimary && (
        <Html
          position={hoveredPrimary.position}
          center
          distanceFactor={11}
          style={{ pointerEvents: "none" }}
        >
          <div className="max-w-56 whitespace-nowrap rounded-full border border-amber-100/20 bg-black/85 px-3 py-1.5 text-[9px] tracking-wide text-amber-50 shadow-[0_8px_30px_#000] backdrop-blur-xl">
            {hoveredPrimary.memory.title}
          </div>
        </Html>
      )}
    </>
  );
}

export default function UniverseScene({
  memories,
  connections,
  onSelect,
}: {
  memories: Memory[];
  connections: Connection[];
  onSelect: (memory: Memory) => void;
}) {
  const map = useMemo(() => buildNodes(memories), [memories]);
  return (
    <Canvas
      camera={{ position: [0, 0.8, 20.5], fov: 50 }}
      dpr={[1, 1.7]}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
    >
      <color attach="background" args={["#020202"]} />
      <fog attach="fog" args={["#020202", 20, 48]} />
      <ambientLight intensity={0.06} />
      <Nebula />
      <Dust />
      <OrbitalArcs />
      <BlackHole />
      <MemoryGraph
        nodes={map.nodes}
        clusters={map.clusters}
        connections={connections}
        onSelect={onSelect}
      />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.04}
        minDistance={9}
        maxDistance={31}
        autoRotate
        autoRotateSpeed={0.1}
        target={[0, -0.4, 0]}
      />
    </Canvas>
  );
}
