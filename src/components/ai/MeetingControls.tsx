'use client';

interface Props {
  isRecording: boolean;
  isAnalyzing: boolean;
  onToggleMic: () => void;
  onManualAsk: () => void;
  onEnd: () => void;
}

export function MeetingControls({ isRecording, isAnalyzing, onToggleMic, onManualAsk, onEnd }: Props) {
  return (
    <div className="shrink-0 border-t border-border bg-surface px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">

        {/* 녹음 토글 */}
        <button
          onClick={onToggleMic}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
            isRecording
              ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
              : 'bg-surface2 border border-border text-slate-300 hover:border-accent/50 hover:text-accent'
          }`}
        >
          {isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span>녹음 중지</span>
              <div className="flex items-end gap-0.5 h-4 ml-1">
                {[0,1,2,3,4].map((i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-red-400 rounded-full animate-waveAnim"
                    style={{ height: '60%', animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4zm-7 10a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5zm7 10v-3h-2v3H7v2h10v-2h-3z" />
              </svg>
              <span>녹음 시작</span>
            </>
          )}
        </button>

        {/* AI에게 묻기 */}
        <button
          onClick={onManualAsk}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? (
            <>
              <div className="flex gap-0.5">
                {[0,1,2].map((i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <span>분석 중...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span>AI에게 묻기</span>
            </>
          )}
        </button>

        {/* 회의 종료 */}
        <button
          onClick={onEnd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-surface2 border border-border text-slate-400 hover:border-red-500/40 hover:text-red-400 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
          </svg>
          <span>회의 종료</span>
        </button>
      </div>
    </div>
  );
}
