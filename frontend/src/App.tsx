import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useSimulation } from './hooks/useSimulation';
import { AgentNode } from './components/AgentNode';
import { MoneyFlow } from './components/MoneyFlow';
import { HUD } from './components/HUD';
import type { AgentSnapshot } from './types';

function Scene({
  agents,
  flows,
  richestId,
  selectedId,
  setSelectedId,
  removeFlow,
}: {
  agents:     AgentSnapshot[];
  flows:      ReturnType<typeof useSimulation>['flows'];
  richestId:  string | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  removeFlow: (id: string) => void;
}) {
  return (
    <group onPointerMissed={() => setSelectedId(null)}>
      <color attach="background" args={['#020612']} />
      <ambientLight intensity={0.1} />
      <directionalLight position={[10, 8, 5]} intensity={0.2} color="#ffffff" />

      <Stars radius={100} depth={60} count={4000} factor={3} saturation={0} fade speed={0.3} />

      {agents.map(agent => (
        <AgentNode
          key={agent.id}
          agent={agent}
          isRichest={agent.id === richestId}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ))}

      {flows.map(flow => (
        <MoneyFlow key={flow.id} flow={flow} selectedId={selectedId} onComplete={removeFlow} />
      ))}

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.85}
          intensity={1.4}
          mipmapBlur
          levels={7}
        />
      </EffectComposer>

      {/*
        Slightly tilted: camera at y=3 gives a subtle top-down perspective.
        autoRotate at 0.25 — barely perceptible, makes the scene feel alive.
      */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={6}
        maxDistance={40}
        autoRotate
        autoRotateSpeed={0.25}
        target={[0, 0, 0]}
      />
    </group>
  );
}

export default function App() {
  const { agents, archive, events, flows, cycle, connected, session, removeFlow, reconnect } = useSimulation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Find the richest active processor — winner narrative
  const richestId = useMemo(() => {
    const processors = agents
      .filter(a => a.type === 'Processor' && a.status !== 'dead');
    if (processors.length === 0) return null;
    return processors.reduce((best, a) => a.balance > best.balance ? a : best).id;
  }, [agents]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020612', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 3, 20], fov: 58 }}
        gl={{ antialias: true, alpha: false }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <Suspense fallback={null}>
          <Scene
            agents={agents}
            flows={flows}
            richestId={richestId}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            removeFlow={removeFlow}
          />
        </Suspense>
      </Canvas>

      <HUD
        cycle={cycle}
        agents={agents}
        archive={archive}
        events={events}
        connected={connected}
        session={session}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* ── Session End Overlay ─────────────────────────────────── */}
      {session.ended && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(2, 6, 18, 0.92)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Space Mono', 'Courier New', monospace",
        }}>
          <div style={{
            background: 'rgba(10, 15, 30, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: '48px 56px', textAlign: 'center', maxWidth: 480,
            boxShadow: '0 0 60px rgba(74, 158, 255, 0.15)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏁</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: '#fff', marginBottom: 8 }}>SESSION ENDED</div>
            <div style={{ fontSize: 11, color: '#555', letterSpacing: 2, marginBottom: 32 }}>Demo time limit reached</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 36 }}>
              {[
                { label: 'Cycles Run',     value: cycle },
                { label: 'Agents Seen',    value: archive.length },
                { label: 'On-Chain Tx',    value: session.realTxCount },
                { label: 'Mode',           value: session.mode ?? '—' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 16px'
                }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#4a9eff' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginTop: 4 }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            <button onClick={reconnect} style={{
              background: 'linear-gradient(135deg, #1a4e8a, #2a6eba)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '14px 40px', fontSize: 13, fontWeight: 700,
              letterSpacing: 2, cursor: 'pointer',
              fontFamily: "'Space Mono', 'Courier New', monospace",
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 4px 20px rgba(42, 110, 186, 0.4)',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
            >
              ↺ &nbsp; START NEW SESSION
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
