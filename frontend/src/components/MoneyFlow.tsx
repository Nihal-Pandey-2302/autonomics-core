import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { getAgentPosition } from './AgentNode';
import type { FlowItem } from '../hooks/useSimulation';

interface Props {
  flow:       FlowItem;
  selectedId: string | null;
  onComplete: (id: string) => void;
}

function bezier(
  t: number,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number]
): THREE.Vector3 {
  const mt = 1 - t;
  return new THREE.Vector3(
    mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
    mt * mt * p0[2] + 2 * mt * t * p1[2] + t * t * p2[2],
  );
}

export function MoneyFlow({ flow, selectedId, onComplete }: Props) {
  const headRef  = useRef<THREE.Mesh>(null!);
  const trailRef = useRef<THREE.Mesh>(null!);
  const textRef  = useRef<THREE.Group>(null!);
  const progress = useRef(0);
  const done     = useRef(false);

  const startType = flow.from.split('-')[0];
  const endType   = flow.to.split('-')[0];
  const from = getAgentPosition(flow.from, startType);
  const to   = getAgentPosition(flow.to, endType);
  // Arc Control point — peak above the midpoint
  const ctrl: [number, number, number] = [
    (from[0] + to[0]) / 2,
    Math.max(from[1], to[1]) + 3.5,
    0,
  ];

  const isRelevant = selectedId === null || selectedId === flow.from || selectedId === flow.to;
  const opacity = isRelevant ? 1 : 0.15;

  useFrame((_, delta) => {
    if (done.current) return;
    progress.current += delta / 1.1; // 1.1s travel time

    if (progress.current >= 1) {
      done.current = true;
      onComplete(flow.id);
      return;
    }

    const t = progress.current;
    const pos = bezier(t, from, ctrl, to);

    if (headRef.current)  headRef.current.position.copy(pos);
    if (textRef.current)  textRef.current.position.copy(pos);

    const trailT = Math.max(0, t - 0.07);
    const tPos = bezier(trailT, from, ctrl, to);
    if (trailRef.current) trailRef.current.position.copy(tPos);
  });

  // Short ID for the label
  const label = flow.id.split('-')[0].substring(0, 6) + '...';

  return (
    <group>
      {/* Leading coin */}
      <mesh ref={headRef} position={from}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={opacity} />
      </mesh>
      {/* Trail */}
      <mesh ref={trailRef} position={from}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ff9900" transparent opacity={opacity * 0.5} />
      </mesh>
      {/* Optional Tx hash label during travel */}
      <group ref={textRef} position={from}>
        {isRelevant && (
           <Text
             position={[0, 0.4, 0]}
             fontSize={0.2}
             color="#ffd700"
             anchorX="center"
             anchorY="bottom"
           >
             {label}
           </Text>
        )}
      </group>
    </group>
  );
}

