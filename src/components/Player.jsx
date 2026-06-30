import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const TIMER_SEC = 30;

export default function Player({ onBack }) {
  const [screen, setScreen] = useState('join');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [game, setGame] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [entry, setEntry] = useState({ s1: '', s2: '', s3: '', lie: null });
  const [vote, setVote] = useState(null);
  const [voteLocked, setVoteLocked] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [timerVal, setTimerVal] = useState(TIMER_SEC);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!gameCode) return;
    const channel = supabase
      .channel(`game-player-${gameCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `code=eq.${gameCode}` },
        payload => {
          const g = payload.new;
          setGame(g);
          handlePhaseChange(g);
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [gameCode, playerName]);

  useEffect(() => {
    if (!game || game.phase !== 'voting') return;
    if (game.voting_start) {
      const elapsed = Math.floor((Date.now() - new Date(game.voting_start).getTime()) / 1000);
      const left = Math.max(0, TIMER_SEC - elapsed);
      setTimerVal(left);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimerVal(v => Math.max(0, v - 1));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [game?.phase, game?.voting_start]);

  function handlePhaseChange(g) {
    const curRound = g.rounds && g.rounds[g.current_round];
    const isMyRound = curRound && curRound.name === playerName;
    if (g.phase === 'voting' && !isMyRound) {
      setVote(null); setVoteLocked(false);
      setScreen('vote');
    } else if ((g.phase === 'revealed' || g.phase === 'round-idle') && screen === 'vote') {
      setScreen('result');
    } else if (g.phase === 'final') {
      setScreen('result');
    }
  }

  async function joinGame() {
    const code = joinCode.trim().toUpperCase();
    const name = joinName.trim();
    if (!code || code.length < 3) { setErr('Enter the game code.'); return; }
    if (!name) { setErr('Enter your name.'); return; }
    setLoading(true); setErr('');
    const { data, error } = await supabase.from('games').select('*').eq('code', code).single();
    if (error || !data) { setErr('Game not found. Check the code and try again.'); setLoading(false); return; }
    if (data.phase !== 'lobby') { setErr('This game has already started.'); setLoading(false); return; }
    const players = { ...data.players, [name]: { name, submitted: false, joinedAt: new Date().toISOString() } };
    const { error: upErr } = await supabase.from('games').update({ players, updated_at: new Date().toISOString() }).eq('code', code);
    if (upErr) { setErr('Could not join. Try again.'); setLoading(false); return; }
    setGameCode(code); setPlayerName(name);
    const { data: fresh } = await supabase.from('games').select('*').eq('code', code).single();
    setGame(fresh);
    setScreen('submit');
    setLoading(false);
  }

  async function submitAnswers() {
    const { s1, s2, s3, lie } = entry;
    if (!s1 || !s2 || !s3 || lie === null) return;
    setLoading(true);
    const { data: current } = await supabase.from('games').select('players').eq('code', gameCode).single();
    const players = { ...current.players, [playerName]: { name: playerName, submitted: true, s1: s1.trim(), s2: s2.trim(), s3: s3.trim(), lie } };
    await supabase.from('games').update({ players, updated_at: new Date().toISOString() }).eq('code', gameCode);
    setScreen('wait');
    setLoading(false);
  }

  async function lockVote() {
    if (vote === null) return;
    const { data: current } = await supabase.from('games').select('votes').eq('code', gameCode).single();
    const votes = { ...current.votes, [playerName]: vote };
    await supabase.from('games').update({ votes, updated_at: new Date().toISOString() }).eq('code', gameCode);
    setVoteLocked(true);
  }

  if (screen === 'join') return (
    <div className="card">
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Join the game</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Enter the code your host shared</div>
      <div className="lbl">Game code</div>
      <input className="input code-input" placeholder="e.g. AB3X" maxLength={4} value={joinCode}
        onChange={e => setJoinCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && joinGame()} />
      <div className="lbl">Your name</div>
      <input className="input" placeholder="Your name..." value={joinName}
        onChange={e => setJoinName(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinGame()} />
      {err && <div className="err">{err}</div>}
      <button className="btn primary full" onClick={joinGame} disabled={loading}>{loading ? 'Joining...' : '→ Join'}</button>
      <button className="btn full" onClick={onBack} style={{ marginTop: 8 }}>← Back</button>
    </div>
  );

  if (screen === 'submit') return (
    <div className="card">
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Hi {playerName}!</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Your answers are private — only you can see this screen
      </div>
      {['s1', 's2', 's3'].map((k, i) => (
        <div key={k}>
          <div className="lbl">Statement {i + 1}</div>
          <textarea className="textarea" placeholder="A truth or your lie..." value={entry[k]}
            onChange={e => setEntry(prev => ({ ...prev, [k]: e.target.value }))} />
        </div>
      ))}
      <div className="lbl">Which one is the lie?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[0, 1, 2].map(i => (
          <button key={i} className={`stmt ${entry.lie === i ? 'selected' : ''}`}
            onClick={() => setEntry(prev => ({ ...prev, lie: i }))}>
            Statement {i + 1}
          </button>
        ))}
      </div>
      <button className="btn success full" onClick={submitAnswers}
        disabled={!entry.s1 || !entry.s2 || !entry.s3 || entry.lie === null || loading}>
        {loading ? 'Locking in...' : '✓ Lock in my answers'}
      </button>
    </div>
  );

  if (screen === 'wait') return (
    <div className="card center">
      <div style={{ fontSize: 40, marginBottom: 12 }} className="pulse">⏳</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Locked in! Waiting for the host...</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Code: <strong>{gameCode}</strong></div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }} className="pulse">Syncing in real time...</div>
    </div>
  );

  if (screen === 'vote') {
    const round = game?.rounds?.[game.current_round];
    if (!round) return <div className="card center"><div className="pulse">Waiting...</div></div>;
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Which is {round.name}'s lie?</div>
          <div className={`timer ${timerVal <= 8 ? 'urgent' : ''}`}>{timerVal}s</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>Tap your answer — only you can see your vote</div>
        {round.stmts.map((s, i) => (
          <div key={i} className={`stmt${vote === i ? ' selected' : ''}${voteLocked && vote !== i ? ' dimmed' : ''}`}
            onClick={() => !voteLocked && setVote(i)}>
            <span className="stmt-num">{i + 1}.</span>{s}
            {vote === i && <span className="badge purple" style={{ float: 'right' }}>Your pick</span>}
          </div>
        ))}
        {vote !== null && !voteLocked && (
          <button className="btn danger full" onClick={lockVote}>🔒 Lock in my vote</button>
        )}
        {voteLocked && <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 10 }} className="pulse">Vote sent — waiting for host to reveal...</div>}
      </div>
    );
  }

  if (screen === 'result') {
    if (!game) return null;
    if (game.phase === 'final') {
      const myScore = game.scores?.[playerName] || 0;
      const names = (game.rounds || []).map(r => r.name);
      const sorted = [...names].sort((a, b) => (game.scores[b] || 0) - (game.scores[a] || 0));
      const rank = sorted.indexOf(playerName) + 1;
      return (
        <div className="card center">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Game over!</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 240, margin: '0 auto 16px' }}>
            <div className="metric"><div className="metric-lbl">Your score</div><div className="metric-val purple">{myScore}</div></div>
            <div className="metric"><div className="metric-lbl">Your rank</div><div className="metric-val amber">#{rank}</div></div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Check the host screen for the full leaderboard!</div>
        </div>
      );
    }
    const prevIdx = Math.max(0, game.current_round - (game.phase === 'round-idle' ? 1 : 0));
    const prev = game.rounds?.[prevIdx];
    const myVote = game.votes?.[playerName];
    const iGotIt = myVote !== undefined && myVote === prev?.lie;
    const myScore = game.scores?.[playerName] || 0;
    return (
      <div className="card center">
        <div style={{ fontSize: 52, marginBottom: 8 }}>{iGotIt ? '✅' : '❌'}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{iGotIt ? 'You spotted it!' : 'You were fooled!'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{iGotIt ? '+1 point for guessing correctly' : 'Better luck next round!'}</div>
        <div className="metric" style={{ maxWidth: 140, margin: '0 auto 16px' }}>
          <div className="metric-lbl">Your total score</div>
          <div className="metric-val purple">{myScore} pts</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }} className="pulse">Waiting for next round...</div>
      </div>
    );
  }

  return null;
}
