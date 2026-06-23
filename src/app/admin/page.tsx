'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';

type SurveyRecord = {
  id: string;
  type: 'entry' | 'exit';
  sessionCode: string | null;
  deviceId: string;
  timestamp: number;
  answers: Record<string, string | string[]>;
};

function avg(records: SurveyRecord[], key: string): string {
  const vals = records.map((r) => Number(r.answers[key])).filter((n) => !isNaN(n) && n > 0);
  if (!vals.length) return '-';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function dist(records: SurveyRecord[], key: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of records) {
    const val = r.answers[key];
    if (Array.isArray(val)) {
      for (const v of val) map[v] = (map[v] ?? 0) + 1;
    } else if (typeof val === 'string' && val) {
      map[val] = (map[val] ?? 0) + 1;
    }
  }
  return map;
}

function DistBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 shrink-0 text-slate-400 truncate">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-500 w-14 text-right">{count}명 ({pct}%)</span>
    </div>
  );
}

export default function AdminPage() {
  const [surveys, setSurveys] = useState<SurveyRecord[] | null>(null);
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    if (!unlocked || !isFirebaseConfigured) return;
    const db = getDb();
    const surveysRef = ref(db, 'surveys');
    const unsub = onValue(surveysRef, (snap) => {
      if (!snap.exists()) { setSurveys([]); return; }
      const raw = snap.val() as Record<string, Omit<SurveyRecord, 'id'>>;
      const list = Object.entries(raw).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => b.timestamp - a.timestamp);
      setSurveys(list);
    });
    return () => unsub();
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-xs">
          <h1 className="text-xl font-bold text-slate-200 mb-1">설문 결과</h1>
          <p className="text-slate-500 text-sm mb-6">PIN을 입력하세요</p>
          <input
            type="password"
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-slate-200 mb-3 focus:outline-none focus:border-accent/60"
            placeholder="PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (pin === (process.env.NEXT_PUBLIC_ADMIN_PIN ?? '1234')) {
                  setUnlocked(true);
                } else {
                  setPinError(true);
                }
              }
            }}
          />
          {pinError && <p className="text-red-400 text-xs mb-3">PIN이 틀렸습니다</p>}
          <button
            onClick={() => {
              if (pin === (process.env.NEXT_PUBLIC_ADMIN_PIN ?? '1234')) {
                setUnlocked(true);
              } else {
                setPinError(true);
              }
            }}
            className="w-full py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:opacity-90"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  if (!surveys) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">불러오는 중...</div>;
  }

  const entry = surveys.filter((s) => s.type === 'entry');
  const exit  = surveys.filter((s) => s.type === 'exit');

  const entryDist = (key: string) => dist(entry, key);
  const exitDist  = (key: string) => dist(exit, key);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-200 mb-1">설문 결과</h1>
      <p className="text-slate-500 text-sm mb-8">
        전체 응답 <span className="text-slate-300 font-semibold">{surveys.length}건</span>
        &nbsp;(사전 {entry.length} · 사후 {exit.length})
      </p>

      {/* ── 사전 설문 ── */}
      <section className="card mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">사전 설문 ({entry.length}명)</h2>

        <div className="space-y-5">
          <div>
            <p className="text-xs text-slate-500 mb-2">AI 중재자 기대감 평균</p>
            <p className="text-3xl font-bold text-accent">{avg(entry, 'expectation')}<span className="text-base text-slate-500 font-normal"> / 5</span></p>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">팀 규모</p>
            <div className="space-y-1.5">
              {['2~3명', '4~6명', '7명 이상'].map((opt) => (
                <DistBar key={opt} label={opt} count={entryDist('team_size')[opt] ?? 0} total={entry.length} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">평소 회의 어려움 (복수선택)</p>
            <div className="space-y-1.5">
              {['발언이 한쪽으로 쏠림', '결론 없이 끝남', '갈등/의견 충돌', '회의가 너무 오래 걸림', '기타'].map((opt) => (
                <DistBar key={opt} label={opt} count={entryDist('pain')[opt] ?? 0} total={entry.length} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">유입 경로</p>
            <div className="space-y-1.5">
              {['팀 내부 공유', '지인 추천', 'SNS/온라인', '기타'].map((opt) => (
                <DistBar key={opt} label={opt} count={entryDist('source')[opt] ?? 0} total={entry.length} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 사후 설문 ── */}
      <section className="card mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">사후 설문 ({exit.length}명)</h2>

        <div className="space-y-5">
          <div>
            <p className="text-xs text-slate-500 mb-2">전반적 만족도 평균</p>
            <p className="text-3xl font-bold text-accent">{avg(exit, 'satisfaction')}<span className="text-base text-slate-500 font-normal"> / 5</span></p>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">AI가 실제 회의 흐름을 바꿨나요?</p>
            <div className="space-y-1.5">
              {['예, 확실히 달라졌어요', '약간 영향이 있었어요', '잘 모르겠어요', '아니요'].map((opt) => (
                <DistBar key={opt} label={opt} count={exitDist('real_impact')[opt] ?? 0} total={exit.length} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">재사용 의향</p>
            <div className="space-y-1.5">
              {['예, 적극 사용할게요', '아마 사용할 것 같아요', '아직 모르겠어요', '아니요'].map((opt) => (
                <DistBar key={opt} label={opt} count={exitDist('reuse')[opt] ?? 0} total={exit.length} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">AI 개입 빈도</p>
            <div className="space-y-1.5">
              {['너무 많았어요', '적절했어요', '너무 적었어요'].map((opt) => (
                <DistBar key={opt} label={opt} count={exitDist('frequency')[opt] ?? 0} total={exit.length} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">가장 유용했던 기능</p>
            <div className="space-y-1.5">
              {['실시간 AI 중재', '회의 분석 요약', '액션 아이템 정리', '다음 주제 추천'].map((opt) => (
                <DistBar key={opt} label={opt} count={exitDist('best_feature')[opt] ?? 0} total={exit.length} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 자유 의견 ── */}
      {exit.some((s) => s.answers.feedback) && (
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">자유 의견</h2>
          <div className="space-y-3">
            {exit
              .filter((s) => s.answers.feedback)
              .map((s) => (
                <div key={s.id} className="text-sm text-slate-300 bg-white/3 rounded-xl px-4 py-3 leading-relaxed">
                  "{s.answers.feedback}"
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
