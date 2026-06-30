import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { genCode } from '../lib/useGame';

const COLORS = ['#534AB7','#0F6E56','#D85A30','#185FA5','#854F0B','#993556','#639922','#A32D2D'];
const TIMER_SEC = 30;
const av = i => COLORS[i % COLORS.length];
const ini = n => n.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

export default function Host({ onBack }) {
  const [tab, setTab] = useState('panel');
  const [game, setGame] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [timerVal, setTimerVal] = useState(TIMER_SEC);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    createGame();
  }, []);

  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`game-host-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `code=eq.${code}` },
        payload => setGame(payload.new))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [code]);

  useEffect(() => {
    if (!timerActive) return;
    if (timerVal <= 0) { setTimerActive(false); return; }
    const t = setTimeout(() => setTimerVal(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timerActive, timerVal]);

  async function createGame() {
    setLoading(true);
    const newCode = genCode();
    const initState = {
      code: newCode,
      phase: 'lobby',
      players: {},
      rounds: [],
      current_round: -1,
      scores: {},
      votes: {},
      voting_start: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('games').insert(initState).select().single();
    if (error) { setErr('Failed to create game. Check Supabase setup.'); setLoading(false); return; }
    setGame(data);
    setCode(newCode);
    setLoading(false);
  }

  async function update(updates) {
    const { data, error } = await supabase
      .from('games').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('code', code).select().single();
    if (error) { setErr(error.message); return null; }
    setGame(data);
    return data;
  }

  async function kickPlayer(name) {
    const players = { ...game.players };
    const scores = { ...game.scores };
    delete players[name]; delete scores[name];
    await update({ players, scores });
  }

  async function startGame() {
    const submitted = Object.values(game.players).filter(p => p.submitted);
    const shuffled = [...submitted].sort(() => Math.random() - 0.5);
    const rounds = shuffled.map(p => ({ name: p.name, stmts: [p.s1, p.s2, p.s3], lie: p.lie }));
    const scores = {};
    submitted.forEach(p => scores[p.name] = 0);
    await update({ phase: 'round-idle', rounds, current_round: 0, scores, votes: {} });
  }

  async function beginVoting() {
    await update({ phase: 'voting', votes: {}, voting_start: new Date().toISOString() });
    setTimerVal(TIMER_SEC);
    setTimerActive(true);
  }

  function resetTimer() { setTimerVal(TIMER_SEC); setTimerActive(true); }
  function stopTimer() { setTimerActive(false); setTimerVal(0); }

  async function revealLie() {
    setTimerActive(false);
    const round = game.rounds[game.current_round];
    const lieIdx = round.lie;
    const allNames = game.rounds.map(r => r.name);
    const voters = allNames.filter(n => n !== round.name);
    const votes = game.votes || {};
    const fooled = voters.filter(v => votes[v] !== undefined && votes[v] !== lieIdx);
    const correct = voters.filter(v => votes[v] === lieIdx);
    const scores = { ...game.scores };
    scores[round.name] = (scores[round.name] || 0) + fooled.length;
    correct.forEach(v => { scores[v] = (scores[v] || 0) + 1; });
    await update({ phase: 'revealed', scores });
  }

  async function nextRound() {
    setTimerVal(TIMER_SEC);
    await update({ phase: 'round-idle', current_round: game.current_round + 1, votes: {} });
  }

  async function endGame() {
    await update({ phase: 'final' });
  }

  if (loading) return <div className="card" style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" />Creating game...</div>;
  if (err) return <div className="card"><div className="err">{err}</div><button className="btn" onClick={onBack}>Back</button></div>;
  if (!game) return null;

  const players = Object.values(game.players || {});
  const ready = players.filter(p => p.submitted);

  return (
    <div>
      {game.phase !== 'lobby' && (
        <div className="tab-bar">
          <button className={`tab ${tab === 'panel' ? 'active' : ''}`} onClick={() => setTab('panel')}>Host panel</button>
          <button className={`tab ${tab === 'board' ? 'active' : ''}`} onClick={() => setTab('board')}>Scoreboard</button>
        </div>
      )}

      {game.phase === 'lobby' && <Lobby game={game} code={code} players={players} ready={ready} onKick={kickPlayer} onStart={startGame} onBack={onBack} />}
      {game.phase !== 'lobby' && tab === 'panel' && <GamePanel game={game} timerVal={timerVal} timerActive={timerActive} onBeginVoting={beginVoting} onResetTimer={resetTimer} onStopTimer={stopTimer} onReveal={revealLie} onNext={nextRound} onEnd={endGame} />}
      {game.phase !== 'lobby' && tab === 'board' && <Scoreboard game={game} />}
    </div>
  );
}

function Lobby({ game, code, players, ready, onKick, onStart, onBack }) {
  return (
    <div className="card">
      <div className="card-header">
        <div style={{ fontSize: 20, fontWeight: 600 }}>Host lobby</div>
        <span className="badge purple">👑 Host</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Share this code — players open the app and tap "I'm a player"
      </div>
      <div className="lbl">Game code — share this</div>
      <div className="code-box">{code}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="metric"><div className="metric-lbl">Joined</div><div className="metric-val">{players.length}</div></div>
        <div className="metric"><div className="metric-lbl">Ready</div><div className="metric-val green">{ready.length}</div></div>
      </div>
      {players.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div className="lbl">Players</div>
          {players.map((p, i) => (
            <div className="prow" key={p.name}>
              <div className="avatar" style={{ background: av(i) }}>{ini(p.name)}</div>
              <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
              <span className={`badge ${p.submitted ? 'success' : 'warn pulse'}`}>{p.submitted ? 'Ready' : 'Typing...'}</span>
              {p.submitted && <button className="btn-sm" onClick={() => onKick(p.name)} style={{ marginLeft: 8 }}>✕</button>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--text-tertiary)' }} className="pulse">
          Waiting for players to join...
        </div>
      )}
      <button className="btn success full" onClick={onStart} disabled={ready.length < 2}>
        ▶ Start game ({ready.length} ready)
      </button>
      {ready.length < 2 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>Need at least 2 ready players</div>}
      <button className="btn full" onClick={onBack} style={{ marginTop: 8 }}>← Back</button>
    </div>
  );
}

function GamePanel({ game, timerVal, timerActive, onBeginVoting, onResetTimer, onStopTimer, onReveal, onNext, onEnd }) {
  if (game.phase === 'final') return <FinalBoard game={game} />;
  const round = game.rounds[game.current_round];
  if (!round) return null;
  const allNames = game.rounds.map(r => r.name);
  const pidx = allNames.indexOf(round.name);
  const voters = allNames.filter(n => n !== round.name);
  const votes = game.votes || {};
  const voteCount = Object.keys(votes).length;
  const allVoted = voteCount >= voters.length;

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar lg" style={{ background: av(pidx) }}>{ini(round.name)}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{round.name}'s round</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Round {game.current_round + 1} of {game.rounds.length}</div>
          </div>
        </div>
        {game.phase === 'voting' && (
          <div className={`timer ${timerVal <= 8 ? 'urgent' : ''}`}>{timerVal}s</div>
        )}
      </div>

      {game.phase === 'round-idle' && (
        <button className="btn primary full" onClick={onBeginVoting}>
          ▶ Show {round.name}'s statements — open voting
        </button>
      )}

      {game.phase !== 'round-idle' && (
        <div style={{ marginBottom: 16 }}>
          <div className="lbl">Statements {game.phase === 'revealed' ? '(revealed)' : ''}</div>
          {round.stmts.map((s, i) => {
            const vc = Object.values(votes).filter(v => v === i).length;
            let cls = 'stmt';
            if (game.phase === 'revealed') cls += i === round.lie ? ' lie' : ' truth';
            return (
              <div className={cls} key={i}>
                <span className="stmt-num">{i + 1}.</span>{s}
                {game.phase !== 'round-idle' && <span className="vote-count">{vc}v</span>}
              </div>
            );
          })}
        </div>
      )}

      {game.phase === 'voting' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="lbl" style={{ margin: 0 }}>Votes ({voteCount}/{voters.length})</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-sm" onClick={onResetTimer}>↺ Reset</button>
              <button className="btn-sm danger" onClick={onStopTimer}>⏸ Stop</button>
            </div>
          </div>
          {voters.map((v, i) => {
            const voted = votes[v] !== undefined;
            const vi = allNames.indexOf(v);
            return (
              <div className="prow" key={v}>
                <div className="avatar sm" style={{ background: av(vi) }}>{ini(v)}</div>
                <span style={{ flex: 1, fontSize: 13 }}>{v}</span>
                {voted ? <span className="badge success">Stmt {votes[v] + 1}</span> : <span className="badge warn pulse">waiting</span>}
              </div>
            );
          })}
          {(allVoted || timerVal <= 0) && (
            <button className="btn danger full" onClick={onReveal} style={{ marginTop: 12 }}>
              👁 Reveal the lie!
            </button>
          )}
        </>
      )}

      {game.phase === 'revealed' && (
        <>
          <div className="lie-reveal-box">
            <div style={{ fontSize: 12, color: '#A32D2D', marginBottom: 4 }}>The lie was statement {round.lie + 1}:</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#791F1F' }}>"{round.stmts[round.lie]}"</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div className="metric"><div className="metric-lbl">Fooled</div><div className="metric-val red">{Object.values(votes).filter(v => v !== round.lie).length}</div></div>
            <div className="metric"><div className="metric-lbl">Correct</div><div className="metric-val green">{Object.values(votes).filter(v => v === round.lie).length}</div></div>
          </div>
          {game.current_round + 1 < game.rounds.length
            ? <button className="btn primary full" onClick={onNext}>Next player →</button>
            : <button className="btn success full" onClick={onEnd}>🏆 Show final scores</button>}
        </>
      )}
    </div>
  );
}

function Scoreboard({ game }) {
  const names = (game.rounds || []).map(r => r.name);
  const sorted = [...names].sort((a, b) => (game.scores[b] || 0) - (game.scores[a] || 0));
  return (
    <div className="card">
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Scoreboard</div>
      {sorted.map((name, i) => {
        const pi = names.indexOf(name);
        return (
          <div className="prow" key={name}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 20 }}>{i + 1}</span>
            <div className="avatar" style={{ background: av(pi) }}>{ini(name)}</div>
            <span style={{ flex: 1, fontSize: 14 }}>{name}</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{game.scores[name] || 0} pts</span>
          </div>
        );
      })}
    </div>
  );
}

function FinalBoard({ game }) {
  const names = (game.rounds || []).map(r => r.name);
  const sorted = [...names].sort((a, b) => (game.scores[b] || 0) - (game.scores[a] || 0));
  const top3 = sorted.slice(0, 3);
  const podOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podH = [56, 84, 40], podC = ['#0F6E56', '#534AB7', '#D85A30'], podL = ['2nd', '1st', '3rd'];
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Game over!</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{names.length} players · {game.rounds.length} rounds</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
        {podOrder.map((name, i) => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{podL[i]}</div>
            <div style={{ height: podH[i], width: 72, background: podC[i], borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 15 }}>{game.scores[name] || 0}</div>
          </div>
        ))}
      </div>
      {sorted.slice(3).map((name, i) => {
        const pi = names.indexOf(name);
        return (
          <div className="prow" key={name} style={{ textAlign: 'left' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 20 }}>{i + 4}</span>
            <div className="avatar sm" style={{ background: av(pi) }}>{ini(name)}</div>
            <span style={{ flex: 1, fontSize: 14 }}>{name}</span>
            <span style={{ fontWeight: 600 }}>{game.scores[name] || 0} pts</span>
          </div>
        );
      })}
    </div>
  );
}
