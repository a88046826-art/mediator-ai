// 프롬프트 빌더 함수들 단위 테스트
// 핵심: AI한테 보내는 프롬프트에 팀/주제/대화가 빠지면 중재 품질이 망가짐

function buildSystemPrompt(context: string, teamSummary: string): string {
  return `당신은 스타트업 팀 전문 AI 중재자입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
오늘 회의 주제: ${context || '없음'}

중재 원칙:
- 발화자를 지목하지 않는다. 누가 말했는지 알 수 없기 때문이다.
- 구체적인 다음 행동 1가지를 반드시 제안한다.
- 2-4문장으로 간결하게. 한국어.`;
}

function buildAutoPrompt(teamSummary: string, context: string, transcriptText: string): string {
  return `당신은 실시간 회의를 조용히 모니터링하는 중재자입니다.

팀 구성: ${teamSummary || '없음'}
회의 주제: ${context || '없음'}

대화 내용:
${transcriptText}

개입 기준 — 아래 상황에서만 말하세요. 웬만하면 SKIP:
- 감정적 충돌이나 공격적 언어가 명확히 보일 때
- 대화가 완전히 다른 방향으로 흘러 회의가 무의미해질 때
- 중요한 결정이 내려지는데 반대 의견이 묻히고 있을 때
- 에너지가 눈에 띄게 떨어지거나 아무도 말을 안 할 때

위 상황이 아니면 반드시 "SKIP"만 반환.

개입할 때:
- 자연스럽고 따뜻한 말투로, 3문장 이내
- 구체적인 다음 행동 하나만 제안
한국어.`;
}

function buildAnalysisPrompt(teamSummary: string, context: string, transcriptText: string): string {
  const hasSpeakers = transcriptText.includes(': ');
  return `당신은 팀 회의 분석 전문가입니다.

팀 구성: ${teamSummary || '없음'}
회의 주제: ${context || '없음'}
${hasSpeakers ? '발화자 태깅 있음.' : '발화자 태깅 없음.'}

=== 대화 기록 ===
${transcriptText || '(없음)'}

아래 3개 섹션으로 분석하세요.

## 1. 📌 회의 주제 확인
## 2. ✅ 결정 수렴 여부
- 수렴된 경우: 어떤 결론인지
- 미수렴된 경우: 결론이 나지 않은 이유 + 문제점 + 해결 방향
## 3. 🕐 시간대별 회의 흐름

한국어로 작성하세요.`;
}

// ── buildSystemPrompt ─────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('팀 이름과 주제가 프롬프트에 포함됨', () => {
    const prompt = buildSystemPrompt('예산 결정', '김건주, 이수진');
    expect(prompt).toContain('예산 결정');
    expect(prompt).toContain('김건주, 이수진');
  });

  it('팀/주제 빈 값이면 기본 문구로 대체 (AI가 undefined 보지 않음)', () => {
    const prompt = buildSystemPrompt('', '');
    expect(prompt).toContain('등록된 팀원 없음');
    expect(prompt).toContain('없음');
    expect(prompt).not.toContain('undefined');
  });

  it('한국어 응답 지시 포함', () => {
    const prompt = buildSystemPrompt('', '');
    expect(prompt).toContain('한국어');
  });
});

// ── buildAutoPrompt ───────────────────────────────────────────────────────────

describe('buildAutoPrompt', () => {
  it('대화 내용이 프롬프트에 포함됨 (없으면 AI가 맥락 없이 판단)', () => {
    const transcript = '[09:00] 김건주: 예산이 부족해요';
    const prompt = buildAutoPrompt('팀', '예산', transcript);
    expect(prompt).toContain(transcript);
  });

  it('SKIP 기준 명시 (없으면 AI가 매번 개입)', () => {
    const prompt = buildAutoPrompt('팀', '주제', '대화');
    expect(prompt).toContain('SKIP');
  });

  it('팀/주제 없으면 "없음" 표시 (undefined 방지)', () => {
    const prompt = buildAutoPrompt('', '', '대화');
    expect(prompt).toMatch(/팀 구성: 없음/);
    expect(prompt).toMatch(/회의 주제: 없음/);
    expect(prompt).not.toContain('undefined');
  });

  it('대화 내용 빈 문자열도 프롬프트에 포함됨', () => {
    const prompt = buildAutoPrompt('팀', '주제', '');
    expect(prompt).toContain('대화 내용:');
  });
});

// ── buildAnalysisPrompt ───────────────────────────────────────────────────────

describe('buildAnalysisPrompt', () => {
  it('팀/주제/대화 내용 모두 포함됨', () => {
    const prompt = buildAnalysisPrompt('김건주, 이수진', '예산 결정', '[09:00] 논의 시작');
    expect(prompt).toContain('김건주, 이수진');
    expect(prompt).toContain('예산 결정');
    expect(prompt).toContain('[09:00] 논의 시작');
  });

  it('발화자 있으면 태깅 있음 표시', () => {
    const prompt = buildAnalysisPrompt('팀', '주제', '김건주: 안녕하세요');
    expect(prompt).toContain('발화자 태깅 있음');
  });

  it('발화자 없으면 태깅 없음 표시', () => {
    const prompt = buildAnalysisPrompt('팀', '주제', '안녕하세요');
    expect(prompt).toContain('발화자 태깅 없음');
  });

  it('3개 섹션 모두 포함 (MVP, AI개입, 말투 섹션 제거됨)', () => {
    const prompt = buildAnalysisPrompt('팀', '주제', '대화');
    expect(prompt).toContain('회의 주제 확인');
    expect(prompt).toContain('결정 수렴 여부');
    expect(prompt).toContain('시간대별 회의 흐름');
    expect(prompt).not.toContain('MVP');
    expect(prompt).not.toContain('말투');
  });

  it('미수렴 시 이유 분석 지시 포함', () => {
    const prompt = buildAnalysisPrompt('팀', '주제', '대화');
    expect(prompt).toContain('결론이 나지 않은 이유');
  });

  it('대화 없으면 (없음) 표시', () => {
    const prompt = buildAnalysisPrompt('팀', '주제', '');
    expect(prompt).toContain('(없음)');
  });
});
