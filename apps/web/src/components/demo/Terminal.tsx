'use client';

import { useEffect, useRef, useState } from 'react';

import styles from './ScrollytellingDemo.module.css';

const CHAR_DELAY_MS = 13;

export interface TerminalProps {
  content: string;
  stepIndex: number;
  flash?: 'success' | 'error';
}

/**
 * Escapes HTML special characters. Input is hardcoded step data — not user input.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Applies syntax coloring to terminal output after typing completes.
 * All line content is HTML-escaped before being wrapped in styled spans.
 */
function colorize(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const safe = escapeHtml(line);
      if (line.startsWith('$'))
        return `<span style="color:#F04E23;font-weight:500">${safe}</span>`;
      if (line.includes('✓  VERIFIED') || line.includes('VERIFIED'))
        return `<span style="color:#F04E23;font-weight:700">${safe}</span>`;
      if (line.includes('✗  FAILED') || line.includes('FAILED'))
        return `<span style="color:#ef4444;font-weight:700">${safe}</span>`;
      if (line.includes('✓'))
        return `<span style="color:#4ade80">${safe}</span>`;
      if (line.includes('✗'))
        return `<span style="color:#ef4444">${safe}</span>`;
      if (line.includes('[DONE]'))
        return `<span style="color:#4ade80">${safe}</span>`;
      if (line.includes('[RUN ]'))
        return `<span style="color:#F04E23">${safe}</span>`;
      if (line.includes('^^^^'))
        return `<span style="color:#ef4444">${safe}</span>`;
      if (line.includes('EXPOSURE DETECTED'))
        return `<span style="color:#ef4444">${safe}</span>`;
      if (line.includes('NO EXPOSURE'))
        return `<span style="color:#4ade80">${safe}</span>`;
      if (line.includes('receipt intact') || line.includes('TRANSFERRED'))
        return `<span style="color:#4ade80">${safe}</span>`;
      if (line.startsWith('────') || line === '────────────────────────────────────────')
        return `<span style="color:#2a2a2a">${safe}</span>`;
      return safe;
    })
    .join('\n');
}

type Phase = 'typing' | 'fading' | 'done';

export function Terminal({ content, stepIndex, flash }: TerminalProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const hasStartedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('typing');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    function startTyping() {
      if (!mountedRef.current) return;
      setPhase('typing');

      if (preRef.current) preRef.current.textContent = '';
      if (cursorRef.current) cursorRef.current.style.display = 'inline-block';

      let index = 0;
      intervalRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        index++;
        if (preRef.current) {
          preRef.current.textContent = content.slice(0, index);
        }
        if (index >= content.length) {
          clearInterval(intervalRef.current!);
          if (cursorRef.current) cursorRef.current.style.display = 'none';
          if (preRef.current) {
            preRef.current.innerHTML = colorize(content);
          }
          if (mountedRef.current) setPhase('done');
        }
      }, CHAR_DELAY_MS);
    }

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startTyping();
    } else {
      setPhase('fading');
      timeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        startTyping();
      }, 200);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // stepIndex drives re-runs, content is derived from stepIndex
  }, [stepIndex]);

  const terminalClass = [
    styles.terminal,
    phase === 'done' && flash === 'error' ? styles.terminalFlashError : '',
    phase === 'done' && flash === 'success' ? styles.terminalFlashSuccess : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={terminalClass}>
      <div className={styles.terminalHeader}>
        <div className={styles.trafficLights}>
          <span className={`${styles.tl} ${styles.tlRed}`} />
          <span className={`${styles.tl} ${styles.tlYellow}`} />
          <span className={`${styles.tl} ${styles.tlGreen}`} />
        </div>
        <span className={styles.terminalTitle}>trustsignal — verify</span>
      </div>
      <div className={`${styles.terminalBody} ${phase === 'fading' ? styles.terminalFading : ''}`}>
        <pre ref={preRef} className={styles.terminalPre} tabIndex={0} />
        <span ref={cursorRef} className={styles.cursor} />
      </div>
    </div>
  );
}
