import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentSnapshot, SimEvent, TickPayload } from '../types';

const WS_URL     = import.meta.env.PROD ? 'wss://autonomics-core.onrender.com' : 'ws://localhost:3001';
const MAX_FLOWS  = 30;
const MAX_EVENTS = 80;

export interface FlowItem {
  id: string;
  from: string;
  to: string;
  amount: number;
}

export interface SessionState {
  mode:  'REAL' | 'SIMULATED' | null;
  ms:    number;
  limit: number;
  realTxCount: number;
  realTxLimit: number;
  ended: boolean;   // true when SESSION_END received
}

export function useSimulation() {
  const [agents,   setAgents]   = useState<AgentSnapshot[]>([]);
  const [archive,  setArchive]  = useState<AgentSnapshot[]>([]);
  const [events,   setEvents]   = useState<SimEvent[]>([]);
  const [flows,    setFlows]    = useState<FlowItem[]>([]);
  const [cycle,    setCycle]    = useState(0);
  const [connected, setConnected] = useState(false);
  const [session,  setSession]  = useState<SessionState>({
    mode: null, ms: 0, limit: 240_000,
    realTxCount: 0, realTxLimit: 50, ended: false
  });

  const wsRef = useRef<WebSocket | null>(null);

  const removeFlow = useCallback((id: string) => {
    setFlows(prev => prev.filter(f => f.id !== id));
  }, []);

  // Called by the "Restart" button in the session end screen
  const reconnect = useCallback(() => {
    setSession(s => ({ ...s, ended: false }));
    setAgents([]);
    setArchive([]);
    setEvents([]);
    setFlows([]);
    setCycle(0);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    attachHandlers(ws); // eslint-disable-line @typescript-eslint/no-use-before-define
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function attachHandlers(ws: WebSocket) {
    ws.onopen  = () => setConnected(true);
    ws.onerror = () => ws.close();

    // NO auto-reconnect on close — user must explicitly restart
    ws.onclose = () => {
      setConnected(false);
    };

    ws.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);

        // Session end signal from server
        if (raw.type === 'SESSION_END') {
          setSession(s => ({ ...s, ended: true }));
          ws.close();
          return;
        }

        const payload = raw as TickPayload;

        if (payload.agents !== undefined)  setAgents(payload.agents);
        if (payload.archive !== undefined) setArchive(payload.archive);
        if (payload.cycle !== undefined)   setCycle(payload.cycle);

        // Update session metadata on every tick
        if (payload.sessionMode) {
          setSession({
            mode:        payload.sessionMode,
            ms:          payload.sessionMs    ?? 0,
            limit:       payload.sessionLimit ?? 240_000,
            realTxCount: payload.realTxCount  ?? 0,
            realTxLimit: payload.realTxLimit  ?? 50,
            ended:       false,
          });
        }

        const evList = payload.events ?? [];

        // Spawn money flow particles for each TX
        const txs = evList.filter(ev => ev.type === 'TX' && ev.from && ev.to);
        if (txs.length > 0) {
          setFlows(prev => {
            const next: FlowItem[] = txs.map(ev => ({
              id:     `${ev.txId ?? (ev.from || '') + (ev.to || '')}-${Date.now()}-${Math.random()}`,
              from:   ev.from!,
              to:     ev.to!,
              amount: ev.amount ?? 0,
            }));
            return [...prev, ...next].slice(-MAX_FLOWS);
          });
        }

        if (evList.length > 0) {
          setEvents(prev => [...prev, ...evList].slice(-MAX_EVENTS));
        }
      } catch { /* ignore parse errors */ }
    };
  }

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    attachHandlers(ws);
    return () => { ws.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { agents, archive, events, flows, cycle, connected, session, removeFlow, reconnect };
}
