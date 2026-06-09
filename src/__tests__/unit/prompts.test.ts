// 프롬프트 빌더 함수들 단위 테스트

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

describe('buildSystemPrompt', () => {
  it('팀 구성과 주제가 포함됨', () => {
    const prompt = buildSystemPrompt('예산 결정', '김건주, 이수진');
    expect(prompt).toContain('예산 결정');
    expect(prompt).toContain('김건주, 이수진');
  });

  it('빈 값이면 기본 문구 사용', () => {
    const prompt = buildSystemPrompt('', '');
    expect(prompt).toContain('등록된 팀원 없음');
    expect(prompt).toContain('없음');
  });

  it('한국어 중재 원칙 포함', () => {
    const prompt = buildSystemPrompt('', '');
    expect(prompt).toContain('한국어');
    expect(prompt).toContain('발화자를 지목하지 않는다');
  });
});

describe('buildAutoPrompt', () => {
  it('SKIP 기준 포함', () => {
    const prompt = buildAutoPrompt('팀', '주제', '대화내용');
    expect(prompt).toContain('SKIP');
  });

  it('대화 내용이 포함됨', () => {
    const transcript = '[09:00] 김건주: 이번 예산이 부족해요';
    const prompt = buildAutoPrompt('팀', '예산', transcript);
    expect(prompt).toContain(transcript);
  });

  it('팀/주제 없으면 "없음" 표시', () => {
    const prompt = buildAutoPrompt('', '', '대화');
    expect(prompt).toMatch(/팀 구성: 없음/);
    expect(prompt).toMatch(/회의 주제: 없음/);
  });
});
