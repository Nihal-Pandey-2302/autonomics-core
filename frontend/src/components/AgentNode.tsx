import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { AgentSnapshot } from '../types';

export function getStringHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export const TYPE_RADIUS: Record<string, number> = {
  Consumer:   8.5,
  Processor:  4.5,
  DataSeller: 1.0,
};

export function getAgentPosition(id: string, type: string): [number, number, number] {
  const hash = getStringHash(id);
  const radius = TYPE_RADIUS[type] ?? 3;
  // Multiply by golden angle approximation (137.5) so consecutive IDs don't tightly cluster
  const angle = ((hash * 137.5) % 360) * (Math.PI / 180);
  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * (radius * 0.6),
    Math.sin(angle * 2) * 2
  ];
}

const TYPE_COLOR: Record<string, string> = {
  Consumer:   '#4a9eff',
  Processor:  '#ffd32a',
  DataSeller: '#26de81',
};

interface Props {
  agent:           AgentSnapshot;
  isRichest:       boolean;
  selectedId:      string | null;
  onSelect:        (id: string | null) => void;
}

export function AgentNode({ agent, isRichest, selectedId, onSelect }: Props) {
  const groupRef  = useRef<THREE.Group>(null!);
  const meshRef   = useRef<THREE.Mesh>(null!);
  const glowRef   = useRef<THREE.Mesh>(null!);
  const crownRef  = useRef<THREE.Mesh>(null!);
  const lightRef  = useRef<THREE.PointLight>(null!);

  const [hovered, setHovered] = useState(false);

  // Start at 0 for smooth pop-in entrance animation
  const sizeRef   = useRef(0);
  const opacRef   = useRef(1.0);
  const scaleRef  = useRef(1.0);

  // Dynamic Orbital Position Strategy
  const pos = getAgentPosition(agent.id, agent.type);
  const isDead     = agent.status === 'dead';
  const isDying    = agent.status === 'dying';
  const baseColor  = TYPE_COLOR[agent.type] ?? '#ffffff';
  const color      = isDead ? '#2a2a2a' : isDying ? '#ff6b6b' : baseColor;

  const isSelected  = selectedId === agent.id;
  const isDimmed    = selectedId !== null && !isSelected;

  // Capped target size logic - prevent absurd nodes
  const targetSize  = isDead ? 0 : Math.max(0.35, Math.min(1.4, agent.balance / 90));
  const targetScale = hovered || isSelected ? 1.18 : 1.0;
  const targetOpac  = isDimmed ? 0.18 : 1.0;

  useFrame((state) => {
    if (!meshRef.current || !groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Smooth size lerp
    sizeRef.current  += (targetSize  - sizeRef.current)  * 0.05;
    // Smooth interaction scale lerp
    scaleRef.current += (targetScale - scaleRef.current) * 0.12;
    // Smooth opacity lerp
    opacRef.current  += (targetOpac  - opacRef.current)  * 0.1;

    meshRef.current.scale.setScalar(sizeRef.current * scaleRef.current);

    // Fade non-selected agents
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity  = opacRef.current;
    mat.transparent = opacRef.current < 1;

    // Float
    const floatY = pos[1] + Math.sin(t * 0.7 + pos[0] * 0.4) * 0.14;
    groupRef.current.position.y += (floatY - groupRef.current.position.y) * 0.08;

    // Glow
    if (glowRef.current) {
      const gm = glowRef.current.material as THREE.MeshBasicMaterial;
      if (isDying) {
        gm.opacity = (0.08 + 0.22 * Math.abs(Math.sin(t * 3.5))) * opacRef.current;
      } else {
        gm.opacity = (isSelected ? 0.16 : 0.06) * opacRef.current;
      }
      glowRef.current.scale.setScalar(sizeRef.current * scaleRef.current * 2.2);
    }

    // Crown for richest
    if (crownRef.current) {
      const cm = crownRef.current.material as THREE.MeshBasicMaterial;
      if (isRichest && !isDead && !isDying) {
        cm.opacity = (0.04 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.2))) * opacRef.current;
        crownRef.current.scale.setScalar(sizeRef.current * scaleRef.current * 3.6);
      } else {
        cm.opacity = 0;
      }
    }

    // Light
    if (lightRef.current) {
      const targetIntensity = (isDying ? 0.5 : Math.min(3.5, 0.8 + agent.balance / 100)) * opacRef.current;
      lightRef.current.intensity += (targetIntensity - lightRef.current.intensity) * 0.06;
    }
  });

  if (isDead) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(isSelected ? null : agent.id);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <group ref={groupRef} position={[pos[0], pos[1], pos[2]]}>
      {/* Crown glow (richest) */}
      <mesh ref={crownRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={baseColor} transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh scale={sizeRef.current * 2.6} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.0, 48]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}

      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} depthWrite={false} side={THREE.BackSide} />
      </mesh>

      {/* Main sphere — clickable */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isDying ? 0.5 : 0.85}
          roughness={0.05}
          metalness={0.95}
          transparent
          opacity={1}
        />
      </mesh>

      <pointLight ref={lightRef} color={color} intensity={2} distance={8} decay={2} />

      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, 2.5, 0]}
          fontSize={0.34}
          color={isSelected ? baseColor : isRichest ? baseColor : 'white'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.05}
          outlineColor="black"
        >
          {isRichest ? `★ ${agent.id}` : agent.id}
        </Text>
        <Text
          position={[0, 2.0, 0]}
          fontSize={0.30}
          color={isDying ? '#ffd32a' : '#aaffaa'}
          anchorX="center"
          anchorY="top"
        >
          {`$${agent.balance}`}
        </Text>
      </Billboard>
    </group>
  );
}
