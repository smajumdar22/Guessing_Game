import React from 'react';

export default function Landing({ onHost, onPlayer }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
        Two Truths and a Lie
      </div>
      <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
        Players submit privately on their own device.<br />
        Host controls everything. Works across any network.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 340, margin: '0 auto 24px' }}>
        <button className="btn-role primary" onClick={onHost}>
          <span style={{ fontSize: 28 }}>👑</span>
          <span style={{ fontWeight: 600 }}>I'm the host</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Create & control the game</span>
        </button>
        <button className="btn-role" onClick={onPlayer}>
          <span style={{ fontSize: 28 }}>🙋</span>
          <span style={{ fontWeight: 600 }}>I'm a player</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Join with a code</span>
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
       Lets play!
      </div>
    </div>
  );
}
