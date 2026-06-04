'use client';

import { useState, useCallback } from 'react';
import './philosopher.css';
import { PhilSvgSprites } from '@/components/philosopher/PhilSvgSprites';
import {
  PHIL_QUESTIONS, PHIL_LABELS, PHIL, PHIL_REGION, CODEMAP, PHIL_ORDER, AX_COLOR,
  type PhilKey,
} from '@/data/philosopherData';

type Screen = 'intro' | 'test' | 'result' | 'gallery';

const AXIS_INFO: Record<string, { color: string; name: string; desc: string }> = {
  D: { color: '#c4453a', name: '실행 | Disruptor', desc: '파괴적 실행력' },
  O: { color: '#d68a1e', name: '비전 | Outreacher', desc: '네트워크 비전' },
  C: { color: '#2f8a72', name: '조율 | Coordinator', desc: '관계와 소통' },
  E: { color: '#5566c2', name: '분석 | Evaluator', desc: '논리적 검증' },
};

function calcPhilResult(scores: Record<string, number>): PhilKey {
  const sorted = (Object.entries(scores) as [string, number][])
    .sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const secondary = sorted[1][0];
  const key = `${primary}${secondary}`;
  return CODEMAP[key] ?? CODEMAP[`${secondary}${primary}`] ?? 'CC';
}

function PhilPortrait({ artId, className }: { artId: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${artId}`} />
    </svg>
  );
}

function PhilScene({ sceneId, className }: { sceneId: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${sceneId}`} />
    </svg>
  );
}

export default function PhilosopherPage() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(PHIL_QUESTIONS.length).fill(null));
  const [resultKey, setResultKey] = useState<PhilKey | null>(null);

  const handleSelect = useCallback((val: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = val;
      return next;
    });
  }, [current]);

  const handleNext = useCallback(() => {
    if (current < PHIL_QUESTIONS.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      // calculate result
      const scores: Record<string, number> = { D: 0, O: 0, C: 0, E: 0 };
      PHIL_QUESTIONS.forEach((q, i) => {
        scores[q.t] += answers[i] ?? 0;
      });
      setResultKey(calcPhilResult(scores));
      setScreen('result');
    }
  }, [current, answers]);

  const handlePrev = useCallback(() => {
    setCurrent((c) => Math.max(0, c - 1));
  }, []);

  const handleRestart = useCallback(() => {
    setScreen('intro');
    setCurrent(0);
    setAnswers(Array(PHIL_QUESTIONS.length).fill(null));
    setResultKey(null);
  }, []);

  const q = PHIL_QUESTIONS[current];
  const progress = (current / PHIL_QUESTIONS.length) * 100;
  const axColor = AXIS_INFO[q?.t]?.color ?? '#c8a44d';

  const scores = (() => {
    const s: Record<string, number> = { D: 0, O: 0, C: 0, E: 0 };
    PHIL_QUESTIONS.forEach((qq, i) => { s[qq.t] += answers[i] ?? 0; });
    return s;
  })();
  const maxScore = 20; // 5 questions × max 4

  const phil = resultKey ? PHIL[resultKey] : null;
  const region = phil ? PHIL_REGION[phil.region] : null;

  return (
    <div className="phil-wrap">
      <PhilSvgSprites />

      {/* ── INTRO ── */}
      {screen === 'intro' && (
        <div className="phil-screen">
          <p className="phil-eyebrow">CODE · PHILOSOPHER TEST</p>
          <h1 className="phil-h1">나는 어떤<br />철학자인가?</h1>
          <p className="phil-lead">
            20개의 질문으로 당신의 CODE 성향을 분석하고,<br />
            고대부터 근대까지 12명의 철학자 중 당신과 가장 닮은 사상가를 찾습니다.
          </p>
          <div className="phil-rule" />

          <div className="phil-axes">
            {Object.entries(AXIS_INFO).map(([key, info]) => (
              <div
                key={key}
                className="phil-axis"
                style={{ borderTopColor: info.color } as React.CSSProperties}
              >
                <div className="l" style={{ color: info.color }}>{key}</div>
                <div className="n">{info.name}</div>
                <div className="d">{info.desc}</div>
              </div>
            ))}
          </div>

          <button className="phil-btn" onClick={() => setScreen('test')}>
            테스트 시작하기
          </button>
          <div style={{ height: 12 }} />
          <button className="phil-btn-ghost" onClick={() => setScreen('gallery')}>
            12인의 철학자 보기
          </button>
        </div>
      )}

      {/* ── TEST ── */}
      {screen === 'test' && (
        <div className="phil-screen">
          <div className="phil-prog">
            <span className="lab">{q.t}</span>
            <div className="bar">
              <div className="fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="num">{current + 1}<span style={{ fontSize: 13, color: 'var(--muted)' }}>/{PHIL_QUESTIONS.length}</span></span>
          </div>

          <div
            className="phil-axbadge"
            style={{ background: axColor } as React.CSSProperties}
          >
            {q.t} · {AXIS_INFO[q.t]?.name}
          </div>

          <div className="phil-qcard" style={{ borderLeftColor: axColor } as React.CSSProperties}>
            <div className="phil-qnum">{String(current + 1).padStart(2, '0')}</div>
            <div className="phil-qtext">{q.q}</div>

            <div className="phil-opts">
              {PHIL_LABELS.map((label, i) => {
                const val = i + 1;
                const selected = answers[current] === val;
                return (
                  <button
                    key={i}
                    className={`phil-opt${selected ? ' sel' : ''}`}
                    style={selected ? { background: axColor, borderColor: axColor } as React.CSSProperties : undefined}
                    onClick={() => handleSelect(val)}
                  >
                    <span className="v">{val}</span>
                    <span className="t">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="phil-nav">
            <button className="p" onClick={handlePrev} disabled={current === 0}>
              이전
            </button>
            <button
              className="n"
              onClick={handleNext}
              disabled={answers[current] === null}
            >
              {current === PHIL_QUESTIONS.length - 1 ? '결과 보기' : '다음'}
            </button>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {screen === 'result' && phil && region && resultKey && (
        <div className="phil-screen">
          <p className="phil-eyer">당신의 철학자 성향은</p>

          <div className="phil-rcard">
            <div className="phil-hero">
              <PhilScene sceneId={region.scene} className="scene" />
              <PhilPortrait artId={phil.art} className="portrait" />
              <div className="badge-region">{region.label}</div>
              <div className="badge-code">{resultKey}</div>
            </div>

            <div className="phil-rinfo">
              <div className="type-label">{phil.type}</div>
              <div className="phil-name">{phil.name}</div>
              <div className="phil-kr">{phil.kr} · {phil.era}</div>

              <div className="phil-quote-block">
                <blockquote>"{phil.quote}"</blockquote>
                <div className="src">— {phil.src}</div>
              </div>

              <p className="phil-desc-text">{phil.desc}</p>
            </div>

            <div className="phil-scores">
              {(['D', 'O', 'C', 'E'] as const).map((code) => (
                <div key={code} className="phil-score-row">
                  <span className="label" style={{ color: AX_COLOR[code] }}>{code}</span>
                  <div className="track">
                    <div
                      className="fill"
                      style={{
                        width: `${(scores[code] / maxScore) * 100}%`,
                        background: AX_COLOR[code],
                      }}
                    />
                  </div>
                  <span className="val">{scores[code]}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 16 }} />
          <button className="phil-btn" onClick={() => setScreen('gallery')}>
            12인의 철학자 보기
          </button>
          <div style={{ height: 10 }} />
          <button className="phil-btn-ghost" onClick={handleRestart}>
            다시 테스트하기
          </button>
        </div>
      )}

      {/* ── GALLERY ── */}
      {screen === 'gallery' && (
        <div className="phil-screen">
          <p className="phil-eyebrow">CODE · PHILOSOPHER GALLERY</p>
          <h1 className="phil-h1" style={{ fontSize: 'clamp(26px,7vw,40px)' }}>12인의 철학자</h1>
          <div className="phil-rule" />

          <div className="phil-gallery-grid">
            {PHIL_ORDER.map((key) => {
              const p = PHIL[key];
              const r = PHIL_REGION[p.region];
              const isMine = key === resultKey;
              return (
                <div
                  key={key}
                  className={`phil-gallery-item${isMine ? ' mine' : ''}`}
                  onClick={() => {
                    setResultKey(key);
                    setScreen('result');
                  }}
                >
                  <div className="thumb">
                    <PhilScene sceneId={r.scene} className="scene-svg" />
                    <PhilPortrait artId={p.art} className="portrait-svg" />
                    {isMine && <div className="phil-mine-badge">MY</div>}
                  </div>
                  <div className="info">
                    <div className="en-name">{p.name}</div>
                    <div className="ko-type">{p.type.split(' — ')[1] ?? p.type}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ height: 20 }} />
          <button
            className="phil-btn-ghost"
            onClick={() => resultKey ? setScreen('result') : setScreen('intro')}
          >
            {resultKey ? '내 결과로 돌아가기' : '처음으로'}
          </button>
        </div>
      )}
    </div>
  );
}
