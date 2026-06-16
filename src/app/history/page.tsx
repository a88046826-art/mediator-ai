'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { MeetingRecord } from '@/types';

type SummaryView = 'action-items' | 'analysis' | 'next-topic';

async function callApi(system: string, userContent: string, maxTokens = 2000): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages: [{ role: 'user', content: userContent }], maxTokens }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
  return data.content as string;
}

function buildActionItemsPrompt(teamSummary: string, topic: string, transcriptText: string): string {
  return `당신은 회의 결과를 정리하는 전문가입니다.\n\n팀 구성: ${teamSummary || '없음'}\n회의 주제: ${topic || '없음'}\n\n=== 대화 기록 ===\n${transcriptText || '(없음)'}\n\n아래 형식으로 간결하게 정리하세요. 없는 항목은 "없음"으로 표시.\n\n## 📋 결정 사항\n각 결정을 "· [내용]" 형식으로 나열\n\n---\n\n## ✅ 액션 아이템\n각 항목을 "· [담당자] — [할 일] ([기한])" 형식으로 나열\n담당자나 기한이 불명확하면 "미정"으로 표시\n\n---\n\n## ⚠️ 미결 사항\n다음 회의에서 다뤄야 할 것들을 "· [내용]" 형식으로 나열\n\n---\n\n한국어로 작성하세요.`;
}

function buildAnalysisPrompt(teamSummary: string, topic: string, transcriptText: string): string {
  const hasSpeakers = transcriptText.includes(': ');
  return `당신은 팀 회의 분석 전문가입니다.\n\n팀 구성: ${teamSummary || '없음'}\n회의 주제: ${topic || '없음'}\n${hasSpeakers ? '발화자 태깅 있음. 이름을 활용하세요.' : '발화자 태깅 없음.'}\n\n=== 대화 기록 ===\n${transcriptText || '(없음)'}\n\n아래 3개 섹션으로 분석하세요.\n\n---\n\n## 1. 📌 회의 주제 확인\n이 회의가 실제로 다룬 핵심 주제를 1-2문장으로 정리하세요.\n\n---\n\n## 2. ✅ 결정 수렴 여부\n결론이 내려졌는지 판단하세요.\n- **수렴된 경우**: 어떤 결론인지 서술\n- **미수렴된 경우**: 결론이 나지 않은 이유 + 문제점 + 해결 방향\n\n---\n\n## 3. 🕐 시간대별 회의 흐름\n[시간] 핵심 내용 형식으로 3-6개 항목.\n\n---\n\n한국어로 작성하세요.`;
}

function buildNextTopicsPrompt(teamSummary: string, topic: string, transcriptText: string): string {
  return `당신은 팀 회의 퍼실리테이터입니다.\n\n팀 구성: ${teamSummary || '없음'}\n이번 회의 주제: ${topic || '없음'}\n\n=== 대화 기록 ===\n${transcriptText || '(없음)'}\n\n이 팀의 이번 회의에 특화된 다음 회의 주제 3가지를 추천하세요.\n\n---\n\n## 🎯 다음 회의 주제 추천\n\n**추천 1: [주제명]**\n- **선택 근거**:\n- **장점**:\n- **예상 소요 시간**:\n- **준비사항**:\n\n---\n\n**추천 2: [주제명]**\n- **선택 근거**:\n- **장점**:\n- **예상 소요 시간**:\n- **준비사항**:\n\n---\n\n**추천 3: [주제명]**\n- **선택 근거**:\n- **장점**:\n- **예상 소요 시간**:\n- **준비사항**:\n\n---\n\n## 💡 다음 회의 진행 팁\n1-2가지 구체적 제안.\n\n한국어로 작성하세요.`;
}

const ANALYSIS_ACTIONS = [
  {
    key: 'action-items' as const,
    emoji: '📋',
    title: '액션 아이템',
    desc: '결정 사항 · 담당자별 할 일 · 미결 사항',
    color: 'from-green-500/20 to-green-500/5 border-green-500/30 hover:border-green-400/60',
    textColor: 'text-green-300',
  },
  {
    key: 'analysis' as const,
    emoji: '📊',
    title: '회의결과 분석',
    desc: '논의사항 · 결정 · 미해결 · 팀 역학',
    color: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 hover:border-violet-400/60',
    textColor: 'text-violet-300',
  },
  {
    key: 'next-topic' as const,
    emoji: '🎯',
    title: '다음 회의 주제 추천',
    desc: '우선순위 · 예상 시간 · 준비사항',
    color: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 hover:border-blue-400/60',
    textColor: 'text-blue-300',
  },
];

function MeetingDetail({ record, onClose }: { record: MeetingRecord; onClose: () => void }) {
  const showToast = useAppStore((s) => s.showToast);
  const [analysisView, setAnalysisView] = useState<SummaryView | null>(null);
  const [analysisContent, setAnalysisContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const transcriptText = record.transcript
    .map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`)
    .join('\n');

  const handleAnalysis = useCallback(async (view: SummaryView) => {
    if (isAnalyzing) return;
    setAnalysisView(view);
    setAnalysisContent('');
    setIsAnalyzing(true);
    try {
      let prompt = '';
      if (view === 'action-items') prompt = buildActionItemsPrompt(record.teamSummary, record.topic, transcriptText);
      else if (view === 'analysis') prompt = buildAnalysisPrompt(record.teamSummary, record.topic, transcriptText);
      else prompt = buildNextTopicsPrompt(record.teamSummary, record.topic, transcriptText);
      const result = await callApi(prompt, '분석해주세요.');
      setAnalysisContent(result);
    } catch {
      setAnalysisContent('분석 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, record, transcriptText]);

  const handleCopy = useCallback(async () => {
    const action = ANALYSIS_ACTIONS.find((a) => a.key === analysisView);
    const lines = [
      action ? `[ ${action.title} ]` : '[ 회의 분석 ]',
      `날짜: ${record.date}`,
      record.topic ? `주제: ${record.topic}` : '',
      record.teamSummary ? `팀: ${record.teamSummary}` : '',
      '',
      analysisContent,
      '',
      '━━━ 대화 기록 ━━━',
      ...record.transcript.map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('클립보드에 복사됐어요!', 'success');
    } catch { showToast('복사 실패.', 'error'); }
  }, [analysisView, analysisContent, record, showToast]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4">
      <div className="bg-surface rounded-2xl w-full max-w-2xl shadow-xl border border-border mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="text-xs text-slate-500">{record.date}</p>
            <h2 className="font-semibold text-slate-200 mt-0.5">{record.topic || '주제 없음'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {record.teamSummary && (
            <p className="text-xs text-slate-500">👥 {record.teamSummary}</p>
          )}

          {/* 대화 기록 */}
          {record.transcript.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">대화 기록</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {record.transcript.map((e) => (
                  <div key={e.id} className="text-sm text-slate-300">
                    <span className="text-slate-500 font-mono text-xs mr-2">{e.time}</span>
                    {e.speaker && <span className="text-accent text-xs mr-1">{e.speaker}</span>}
                    {e.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 중재 내용 */}
          {record.aiMessages.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">AI 중재 내용</p>
              <div className="space-y-3 max-h-52 overflow-y-auto">
                {record.aiMessages.map((m, i) => (
                  <div key={m.id} className="bg-surface2 rounded-xl px-4 py-3 border border-border text-sm text-slate-300 leading-relaxed">
                    <span className="text-xs text-accent mr-2">[{i + 1}]</span>
                    {m.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 분석 섹션 */}
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">AI 분석</p>

            {analysisView === null ? (
              <div className="grid gap-2.5">
                {ANALYSIS_ACTIONS.map((action) => (
                  <button
                    key={action.key}
                    onClick={() => handleAnalysis(action.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-gradient-to-br transition-all text-left ${action.color}`}
                  >
                    <span className="text-2xl shrink-0">{action.emoji}</span>
                    <div>
                      <p className={`font-semibold text-sm ${action.textColor}`}>{action.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{action.desc}</p>
                    </div>
                    <svg className="ml-auto w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => { setAnalysisView(null); setAnalysisContent(''); }}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className={`font-semibold text-sm ${ANALYSIS_ACTIONS.find((a) => a.key === analysisView)?.textColor}`}>
                    {ANALYSIS_ACTIONS.find((a) => a.key === analysisView)?.emoji}{' '}
                    {ANALYSIS_ACTIONS.find((a) => a.key === analysisView)?.title}
                  </span>
                </div>

                {isAnalyzing ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                    <p className="text-sm">분석 중입니다...</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-surface2 rounded-xl border border-border p-4 mb-3">
                      <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{analysisContent}</div>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="w-full py-2.5 text-sm font-medium rounded-xl border border-border text-slate-400 hover:text-accent hover:border-accent/40 transition-colors"
                    >
                      복사
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const meetingHistory = useAppStore((s) => s.meetingHistory);
  const deleteMeeting = useAppStore((s) => s.deleteMeeting);
  const [selected, setSelected] = useState<MeetingRecord | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">회의 기록</h1>
      <p className="text-slate-400 text-sm mb-8">이 기기에 저장된 지난 회의 기록이에요</p>

      {meetingHistory.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-600">
          <p className="text-sm">아직 저장된 회의가 없어요</p>
          <p className="text-xs mt-1">회의 종료 시 자동으로 저장됩니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetingHistory.map((record) => (
            <div
              key={record.id}
              className="card hover:border-accent/40 transition-colors cursor-pointer group"
              onClick={() => setSelected(record)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 mb-1">{record.date}</p>
                  <p className="font-medium text-slate-200 group-hover:text-accent transition-colors truncate">
                    {record.topic || '주제 없음'}
                  </p>
                  {record.teamSummary && (
                    <p className="text-xs text-slate-500 mt-1 truncate">👥 {record.teamSummary}</p>
                  )}
                  <div className="flex gap-3 mt-2 text-xs text-slate-600">
                    <span>🎙 {record.transcript.length}개 발화</span>
                    <span>🤖 AI {record.aiMessages.length}회</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMeeting(record.id); }}
                  className="shrink-0 p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                  aria-label="삭제"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <MeetingDetail record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
