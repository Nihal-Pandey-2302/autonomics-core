import { useState } from 'react';
import type { AgentSnapshot, SimEvent } from '../types';
import type { SessionState } from '../hooks/useSimulation';

interface Props {
  cycle:      number;
  agents:     AgentSnapshot[];
  archive:    AgentSnapshot[];
  events:     SimEvent[];
  connected:  boolean;
  session:    SessionState;
  selectedId: string | null;
  onSelect:   (id: string | null) => void;
}

const TYPE_COLOR: Record<string, string> = {
  Consumer:   '#4a9eff',
  Processor:  '#ffd32a',
  DataSeller: '#26de81',
};

const TYPE_LABEL: Record<string, string> = {
  Consumer:   'Task Agent (Consumer)',
  Processor:  'Service/API (Processor)',
  DataSeller: 'Data Source (DataSeller)'
};

function confirmedLabel(ev: SimEvent): string {
  if (!ev.simulated) return '✔ Settled on Stellar';
  return '⚡ Off-chain execution (batched)';
}

function eventColor(type: string, simulated?: boolean): string {
  switch (type) {
    case 'TX':              return '#4a9eff';
    case 'CONFIRMED':       return simulated ? '#8888bb' : '#26de81'; // real = bright green
    case 'FAIL':            return '#ff6b6b';
    case 'DEATH':           return '#ff4444';
    case 'PENDING':         return '#666';
    case 'DOMINANCE_SHIFT': return '#ffd700';
    case 'MARKET_CRASH':    return '#ff0000';
    case 'NEW_ENTRANT':     return '#ff9f43';
    case 'MARKET_STIMULUS': return '#1dd1a1';
    default:                return '#555';
  }
}

function formatEvent(ev: SimEvent): string {
  switch (ev.type) {
    case 'TX':              return `${ev.from} → ${ev.to} : $${ev.amount}`;
    case 'CONFIRMED':       return confirmedLabel(ev) + `  ${ev.txId?.slice(0, 16)}...`;
    case 'FAIL':            return `[FAIL] ${ev.agentId ?? ev.message}`;
    case 'DEATH':           return `[DEATH] ${ev.agentId}`;
    case 'PENDING':         return `[···] ${ev.txId?.slice(0, 18)}...`;
    case 'DOMINANCE_SHIFT': return `👑 ${ev.message}`;
    case 'MARKET_CRASH':    return `📉 ${ev.message}`;
    case 'NEW_ENTRANT':     return `🆕 ${ev.message}`;
    case 'MARKET_STIMULUS': return `📈 ${ev.message}`;
    default:                return `[${ev.type}]`;
  }
}

const panel: React.CSSProperties = {
  background:    'rgba(2, 6, 18, 0.82)',
  border:        '1px solid rgba(255,255,255,0.07)',
  borderRadius:   12,
  padding:       '14px 18px',
  backdropFilter: 'blur(16px)',
  pointerEvents: 'auto',
  fontFamily: "'Space Mono', 'Courier New', monospace",
  color: '#fff',
};

export function HUD({ cycle, agents, archive, events, connected, session, selectedId, onSelect }: Props) {
  const [filterMode, setFilterMode] = useState<'ALL' | 'SELECTED'>('ALL');
  const [rightPanelTab, setRightPanelTab] = useState<'AGENTS' | 'ARCHIVE'>('AGENTS');
  const [proofEv, setProofEv] = useState<SimEvent | null>(null);

  const remainMs   = Math.max(0, session.limit - session.ms);
  const remainSec  = Math.floor(remainMs / 1000);
  const timerMM    = String(Math.floor(remainSec / 60)).padStart(2, '0');
  const timerSS    = String(remainSec % 60).padStart(2, '0');
  const timerPct   = session.limit > 0 ? Math.max(0, 1 - session.ms / session.limit) : 1;
  const txPct      = session.realTxLimit > 0 ? session.realTxCount / session.realTxLimit : 0;

  const active       = agents.filter(a => a.status === 'active').length;
  const dying        = agents.filter(a => a.status === 'dying').length;
  const totalBalance = agents.filter(a => a.status !== 'dead').reduce((s, a) => s + a.balance, 0);
  
  // Predict Health Trend
  // Stable if dying is low and active is high
  const deathRate = dying / (active + dying || 1);
  const healthLabel = deathRate > 0.4 ? 'DECLINING' : deathRate < 0.1 ? 'GROWING' : 'STABLE';
  const healthColor = deathRate > 0.4 ? '#ff6b6b' : deathRate < 0.1 ? '#26de81' : '#ffd32a';

  const selectedAgent = selectedId 
    ? agents.find(a => a.id === selectedId) || archive.find(a => a.id === selectedId) 
    : null;

  // For the bottom-left feed
  let feedEvents = [...events].reverse();
  if (filterMode === 'SELECTED' && selectedId) {
    feedEvents = feedEvents.filter(ev => 
      ev.agentId === selectedId || ev.from === selectedId || ev.to === selectedId || (ev.txId && ev.txId.includes(selectedId))
    );
  }
  const recentEvents = feedEvents.slice(0, 15); // Show 15 elements for story signals

  const allRightPanelAgents = rightPanelTab === 'AGENTS' ? agents : [...archive].reverse();

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      fontFamily: "'Space Mono', 'Courier New', monospace",
    }}>

      {/* ── Top-left: Brand + live indicator ─────────────────────────── */}
      <div style={{ position: 'absolute', top: 24, left: 24, ...panel }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 3 }}>
          AUTONOMICS
        </div>
        <div style={{ fontSize: 10, color: '#444', letterSpacing: 4, marginTop: 3 }}>
          ECONOMIC SIMULATION
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#26de81' : '#ff6b6b',
            boxShadow: `0 0 8px ${connected ? '#26de81' : '#ff6b6b'}`,
            animation: connected ? 'pulse 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: 10, color: connected ? '#26de81' : '#ff6b6b', letterSpacing: 1 }}>
            {connected ? '● STELLAR TESTNET LIVE' : 'CONNECTING…'}
          </span>
        </div>

        {/* Session mode badge */}
        {session.mode && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
            padding: '4px 10px', borderRadius: 4,
            background: session.mode === 'REAL'
              ? 'rgba(38, 222, 129, 0.12)' : 'rgba(155, 89, 182, 0.15)',
            border: `1px solid ${ session.mode === 'REAL' ? 'rgba(38,222,129,0.3)' : 'rgba(155,89,182,0.3)'}`,
          }}>
            <span style={{ fontSize: 9, letterSpacing: 1,
              color: session.mode === 'REAL' ? '#26de81' : '#cd84f1', fontWeight: 'bold' }}>
              {session.mode === 'REAL' ? '⛓ ON-CHAIN MODE' : '⚡ SIMULATED MODE'}
            </span>
          </div>
        )}

        {/* Demo countdown timer */}
        {session.ms > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: '#555', letterSpacing: 1 }}>SESSION</span>
              <span style={{ fontSize: 9, color: timerPct < 0.2 ? '#ff6b6b' : '#888', fontWeight: 'bold' }}>
                {timerMM}:{timerSS}
              </span>
            </div>
            <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', borderRadius: 1, transition: 'width 0.5s',
                width: `${timerPct * 100}%`,
                background: timerPct < 0.2 ? '#ff6b6b' : '#4a9eff'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: '#555', letterSpacing: 1 }}>ON-CHAIN</span>
              <span style={{ fontSize: 9, color: txPct > 0.85 ? '#ffd32a' : '#888' }}>
                {session.realTxCount}/{session.realTxLimit}
              </span>
            </div>
            <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', borderRadius: 1, transition: 'width 0.5s',
                width: `${Math.min(txPct * 100, 100)}%`,
                background: txPct > 0.85 ? '#ffd32a' : '#26de81'
              }} />
            </div>
          </div>
        )}
        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(38, 222, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(38, 222, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(38, 222, 129, 0); }
          }
        `}</style>
      </div>

      {/* ── Top-center: Cycle stats ───────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 24,
        left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 1,
        ...panel, padding: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        {[
          { label: 'CYCLE',   value: cycle,        color: '#fff' },
          { label: 'HEALTH',  value: healthLabel,  color: healthColor },
          { label: 'ACTIVE',  value: active,       color: '#26de81' },
          { label: 'DYING',   value: dying,        color: '#ffd32a' },
          { label: 'DEAD',    value: archive.length, color: '#ff6b6b' },
          { label: 'TOTAL $', value: totalBalance, color: '#4a9eff' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '14px 22px', textAlign: 'center',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: 2, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Right side container (Agent / Archive List + Inspector) ───────────── */}
      <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Toggle List */}
        {!selectedAgent && (
          <div style={{ ...panel, width: 280, display: 'flex', flexDirection: 'column', maxHeight: 400 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button onClick={() => setRightPanelTab('AGENTS')} style={{ background: rightPanelTab === 'AGENTS' ? '#333' : 'transparent', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10, letterSpacing: 2 }}>ACTIVE AGENTS</button>
              <button onClick={() => setRightPanelTab('ARCHIVE')} style={{ background: rightPanelTab === 'ARCHIVE' ? '#333' : 'transparent', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10, letterSpacing: 2 }}>ARCHIVE</button>
            </div>
            
            <div style={{ overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {allRightPanelAgents.length === 0 && <div style={{ fontSize: 10, color: '#555', textAlign: 'center', marginTop: 20 }}>No agents found</div>}
              {allRightPanelAgents.map(a => (
                <div key={a.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', transition: 'background 0.2s',
                }} onClick={() => onSelect(a.id)}
                   onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: TYPE_COLOR[a.type] ?? '#fff',
                      boxShadow: a.status === 'dead' ? 'none' : `0 0 5px ${TYPE_COLOR[a.type]}`,
                      opacity: a.status === 'dead' ? 0.3 : 1,
                    }} />
                    <span style={{ fontSize: 11, color: a.status === 'dead' ? '#666' : '#bbb' }}>
                      {a.id}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: a.status === 'dead' ? '#666' : a.status === 'dying' ? '#ffd32a' : '#fff',
                  }}>
                    {a.status === 'dead' ? '☠' : `$${a.balance}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inspector Panel */}
        {selectedAgent && (
          <div style={{ ...panel, width: 280, position: 'relative' }}>
            <button 
              onClick={() => onSelect(null)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}
            >×</button>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: 3, marginBottom: 12 }}>INSPECTOR</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: TYPE_COLOR[selectedAgent.type] ?? '#fff',
                  boxShadow: selectedAgent.status === 'dead' ? 'none' : `0 0 8px ${TYPE_COLOR[selectedAgent.type]}`,
                  opacity: selectedAgent.status === 'dead' ? 0.3 : 1
                }} />
              <div style={{ fontSize: 16, fontWeight: 'bold', color: selectedAgent.status === 'dead' ? '#666' : '#fff' }}>{selectedAgent.id}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#666' }}>TYPE</div>
                  <div style={{ fontSize: 12, color: TYPE_COLOR[selectedAgent.type] }}>{selectedAgent.type}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#666' }}>BALANCE</div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#4a9eff' }}>${selectedAgent.balance}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#666' }}>STATUS</div>
                  <div style={{ fontSize: 12, color: selectedAgent.status === 'active' ? '#26de81' : selectedAgent.status === 'dying' ? '#ffd32a' : '#ff6b6b' }}>{selectedAgent.status.toUpperCase()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#666' }}>LIFESPAN</div>
                  <div style={{ fontSize: 12 }}>{selectedAgent.lifespan} cycles</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#666' }}>TOTAL EARNINGS</div>
                  <div style={{ fontSize: 12, color: '#26de81' }}>+${selectedAgent.totalEarnings}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#666' }}>SUCCESS RATE</div>
                  <div style={{ fontSize: 12 }}>{selectedAgent.successCount} wins</div>
                </div>
            </div>

            <div style={{ fontSize: 9, color: '#666', letterSpacing: 2, marginBottom: 8 }}>LAST TRANSACTIONS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
              {[...events].reverse().filter(ev => ev.type === 'TX' && (ev.from === selectedId || ev.to === selectedId)).slice(0, 8).map((ev, i) => (
                <div key={i} style={{ 
                  background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6, fontSize: 10,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <span style={{ color: '#aaa' }}>{ev.from === selectedId ? '→' : '←'} </span>
                    <span>{ev.from === selectedId ? ev.to : ev.from}</span>
                    <span style={{ color: '#ffd700', marginLeft: 8 }}>${ev.amount}</span>
                  </div>
                  <button 
                    onClick={() => setProofEv(ev)}
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
                  >view</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ ...panel, minWidth: 280 }}>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: 3, marginBottom: 10 }}>REAL-WORLD MAPPING</div>
          {[
            { color: '#4a9eff', label: TYPE_LABEL['Consumer'] },
            { color: '#ffd32a', label: TYPE_LABEL['Processor'] },
            { color: '#26de81', label: TYPE_LABEL['DataSeller'] },
            { color: '#ffd700', label: 'Payment Flow (Stellar / Off-chain)' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: color, boxShadow: `0 0 8px ${color}`,
              }} />
              <span style={{ fontSize: 11, color: '#bbb' }}>{label}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 9, color: '#555', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
            <span style={{ color: '#26de81' }}>⛓ Settled on Stellar</span> — high-value settlement<br/>
            <span style={{ color: '#8888bb' }}>⚡ Off-chain execution</span> — high-frequency batched
          </div>
        </div>

      </div>

      {/* ── Bottom-left: Event log ────────────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 24, left: 24, ...panel, width: 420 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: 3 }}>EVENT LOG</div>
          {selectedId && (
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: 2 }}>
              <button 
                onClick={() => setFilterMode('ALL')}
                style={{ background: filterMode === 'ALL' ? '#333' : 'transparent', color: '#fff', border: 'none', padding: '2px 8px', fontSize: 9, borderRadius: 2, cursor: 'pointer' }}
              >ALL</button>
              <button 
                onClick={() => setFilterMode('SELECTED')}
                style={{ background: filterMode === 'SELECTED' ? '#333' : 'transparent', color: '#fff', border: 'none', padding: '2px 8px', fontSize: 9, borderRadius: 2, cursor: 'pointer' }}
              >SELECTED</button>
            </div>
          )}
        </div>

        {/* ── Verified on-chain section (pinned) ── */}
        {(() => {
          const verified = events
            .filter(ev => ev.type === 'CONFIRMED' && ev.simulated === false && ev.txHash)
            .slice(-3)
            .reverse();
          if (verified.length === 0) return null;
          return (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 8, color: '#26de81', letterSpacing: 2, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#26de81', boxShadow: '0 0 6px #26de81' }} />
                VERIFIED ON-CHAIN
              </div>
              {verified.map((ev, i) => (
                <div key={i} onClick={() => setProofEv(events.find(e => e.type === 'TX' && e.txId === ev.txId) ?? ev)}
                  style={{
                    fontSize: 10, color: '#26de81', padding: '5px 8px',
                    border: '1px solid rgba(38, 222, 129, 0.25)',
                    borderRadius: 4, background: 'rgba(38, 222, 129, 0.06)',
                    cursor: 'pointer', marginBottom: 3,
                    boxShadow: '0 0 8px rgba(38, 222, 129, 0.08)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <span>✔ {ev.from} → {ev.to} : ${ev.amount}</span>
                  <span style={{ color: '#26de8180', fontSize: 9 }}>{ev.txHash?.slice(0, 10)}…</span>
                </div>
              ))}
            </div>
          );
        })()}

        {recentEvents.length === 0 && (
          <div style={{ fontSize: 10, color: '#333' }}>Waiting for simulation…</div>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recentEvents.map((ev, i) => {
            const isTx = ev.type === 'TX';
            const isConfirmed = ev.type === 'CONFIRMED';
            const isRealConfirm = isConfirmed && !ev.simulated;
            const isStory = ['DOMINANCE_SHIFT', 'MARKET_CRASH', 'NEW_ENTRANT', 'MARKET_STIMULUS'].includes(ev.type);
            const clickable = isTx || isConfirmed;
            
            const evColor = isConfirmed ? eventColor('CONFIRMED', ev.simulated) : eventColor(ev.type);
            
            return (
              <div key={i} 
                onClick={() => {
                  if (isTx) setProofEv(ev);
                  if (isConfirmed) {
                    const txEv = events.find(e => e.type === 'TX' && e.txId === ev.txId);
                    setProofEv(txEv ?? ev);
                  }
                }}
                style={{
                  fontSize: 10, color: evColor,
                  fontFamily: 'monospace', padding: isStory ? '8px 10px' : '4px 6px',
                  opacity: Math.max(0.2, 1 - i * 0.05),
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  background: isRealConfirm ? 'rgba(38, 222, 129, 0.05)'
                    : isStory ? 'rgba(255,255,255,0.06)'
                    : isTx ? 'rgba(255,255,255,0.02)' : 'transparent',
                  borderRadius: 4, cursor: clickable ? 'pointer' : 'default',
                  border: isRealConfirm ? '1px solid rgba(38, 222, 129, 0.2)'
                    : isTx ? '1px solid rgba(255,255,255,0.03)'
                    : isStory ? `1px solid ${eventColor(ev.type)}40` : 'none',
                  fontWeight: isStory || isRealConfirm ? 'bold' : 'normal',
                  boxShadow: isRealConfirm ? '0 0 8px rgba(38, 222, 129, 0.06)' : 'none',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{formatEvent(ev)}</span>
                  {isTx && <span style={{ color: '#555', flexShrink: 0, marginLeft: 8 }}>tx: {ev.txId?.slice(0, 8)}...</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Transaction Proof Modal ─────────────────────────────────────── */}
      {proofEv && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto', zIndex: 100
        }} onClick={() => setProofEv(null)}>
          
          <div style={{
            ...panel, width: 460, padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            background: 'rgba(5, 10, 20, 0.97)', border: '1px solid rgba(255,255,255,0.1)'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#888', letterSpacing: 2 }}>TRANSACTION DETAILS</div>
              <button 
                onClick={() => setProofEv(null)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}
              >×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, fontSize: 13, marginBottom: 24 }}>
              <div style={{ color: '#555', fontSize: 11 }}>FROM</div>
              <div style={{ color: '#fff' }}>{proofEv.from} <span style={{ fontSize: 10, color: '#444' }}>({proofEv.from?.split('-')[0]})</span></div>
              
              <div style={{ color: '#555', fontSize: 11 }}>TO</div>
              <div style={{ color: '#fff' }}>{proofEv.to} <span style={{ fontSize: 10, color: '#444' }}>({proofEv.to?.split('-')[0]})</span></div>
              
              <div style={{ color: '#555', fontSize: 11 }}>AMOUNT</div>
              <div style={{ color: '#ffd700', fontWeight: 'bold' }}>{proofEv.amount} tokens</div>
              
              <div style={{ color: '#555', fontSize: 11 }}>CYCLE</div>
              <div style={{ color: '#fff' }}>{proofEv.cycle}</div>
              
              <div style={{ color: '#555', fontSize: 11 }}>TX ID</div>
              <div style={{ color: '#888', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{proofEv.txId}</div>
            </div>

            {(() => {
              const confirmedEv = events.find(e => e.type === 'CONFIRMED' && e.txId === proofEv.txId);
              
              if (!confirmedEv) {
                return (
                  <div style={{ 
                    padding: 12, borderRadius: 6, marginBottom: 16,
                    background: 'rgba(255, 211, 42, 0.08)', border: '1px solid rgba(255, 211, 42, 0.25)',
                    color: '#ffd32a', display: 'flex', alignItems: 'center', gap: 10
                  }}>
                    ⏳ Awaiting settlement confirmation…
                  </div>
                );
              }

              if (confirmedEv.simulated) {
                return (
                  <>
                    <div style={{ 
                      padding: 14, borderRadius: 6, marginBottom: 16,
                      background: 'rgba(100, 100, 160, 0.1)', border: '1px solid rgba(120,120,200,0.25)',
                      color: '#aab', lineHeight: 1.6, fontSize: 12
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: 13 }}>⚡ Off-chain execution (batched)</div>
                      High-frequency interactions are executed off-chain for performance,
                      while settlement is handled on Stellar.
                    </div>
                    <div style={{ fontSize: 10, color: '#555', textAlign: 'center' }}>
                      Hybrid execution — this tx is part of an on-chain settlement batch
                    </div>
                  </>
                );
              }

              return (
                <>
                  <div style={{ 
                    padding: 12, borderRadius: 6, marginBottom: 16,
                    background: 'rgba(38, 222, 129, 0.08)', border: '1px solid rgba(38, 222, 129, 0.3)',
                    color: '#26de81', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 'bold'
                  }}>
                    ✔ Verified on Stellar
                  </div>

                  {confirmedEv.txHash && (
                    <>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666', wordBreak: 'break-all', marginBottom: 16, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                        {confirmedEv.txHash}
                      </div>
                      <a 
                        href={`https://stellar.expert/explorer/testnet/tx/${confirmedEv.txHash}`}
                        target="_blank" rel="noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          width: '100%', padding: '13px 0', textAlign: 'center',
                          background: 'linear-gradient(135deg, #1a4e8a, #1e6ab0)',
                          color: '#fff', textDecoration: 'none', borderRadius: 6,
                          fontWeight: 'bold', letterSpacing: 1, cursor: 'pointer',
                          fontSize: 12, border: '1px solid rgba(74, 158, 255, 0.3)',
                          boxShadow: '0 4px 16px rgba(42, 110, 186, 0.3)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg, #1e5a9e, #2272bb)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg, #1a4e8a, #1e6ab0)')}
                      >
                        ⛓ &nbsp; VIEW ON STELLAR EXPLORER
                      </a>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
