import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';

const TIMER_SEC = 30;

export function useGame() {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const channelRef = useRef(null);
  const timerRef = useRef(null);
  const [timerVal, setTimerVal] = useState(TIMER_SEC);

  const fetchGame = useCallback(async (code) => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .single();
    if (error) return null;
    return data;
  }, []);

  const updateGame = useCallback(async (code, updates) => {
    const { data, error } = await supabase
      .from('games')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('code', code)
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  const subscribeToGame = useCallback((code, onUpdate) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    const channel = supabase
      .channel(`game:${code}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `code=eq.${code}`
      }, (payload) => {
        onUpdate(payload.new);
      })
      .subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, []);

  const startTimer = useCallback((seconds = TIMER_SEC, onTick, onDone) => {
    clearInterval(timerRef.current);
    setTimerVal(seconds);
    let val = seconds;
    timerRef.current = setInterval(() => {
      val--;
      setTimerVal(val);
      if (onTick) onTick(val);
      if (val <= 0) {
        clearInterval(timerRef.current);
        if (onDone) onDone();
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setTimerVal(0);
  }, []);

  const resetTimer = useCallback((seconds = TIMER_SEC) => {
    clearInterval(timerRef.current);
    setTimerVal(seconds);
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  return {
    game, setGame, loading, setLoading, error, setError,
    fetchGame, updateGame, subscribeToGame,
    timerVal, startTimer, stopTimer, resetTimer, TIMER_SEC
  };
}

export function genCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}
