export const PHIL_QUESTIONS = [
  { t: 'D', q: '완벽한 기획보다 핵심만 담은 MVP를 빠르게 내놓고 반응을 보며 수정한다.' },
  { t: 'D', q: '기존 관행이 비효율적이면 마찰을 감수하고 새로운 방식을 강하게 추진한다.' },
  { t: 'D', q: '데이터 끼워맞추기보다 기존의 판을 엎는 파괴적인 아이디어 실행을 선호한다.' },
  { t: 'D', q: '팀 내 의견이 교착되면 총대를 메고 과감하게 결단을 내리는 역할을 맡는다.' },
  { t: 'D', q: '목표 달성을 위해서라면 다소 리스크가 있어도 공격적인 일정과 타겟을 설정한다.' },
  { t: 'O', q: "프로젝트를 시작할 때 '무엇'보다 '왜' 해야 하는지 비전을 먼저 설득한다." },
  { t: 'O', q: '외부 파트너·멘토 등 다양한 사람들과 관계를 구축해 기회를 가져오는 데 능숙하다.' },
  { t: 'O', q: '팀 사기가 떨어지면 사람들의 감정을 빠르게 읽어 분위기를 환기하고 동기부여한다.' },
  { t: 'O', q: '아이디어를 매력적인 스토리로 포장해 타인의 마음을 움직이는 데 자신 있다.' },
  { t: 'O', q: '성과만큼이나 팀원 간 긍정적인 관계와 에너지 교류가 중요하다고 생각한다.' },
  { t: 'C', q: '독단 통제보다 정보가 투명하게 공유되고 협력하는 소통 환경이 필수라고 본다.' },
  { t: 'C', q: "세세한 지시보다 팀원이 스스로 역량을 발휘하도록 돕는 '방향키' 역할에 집중한다." },
  { t: 'C', q: '누군가 뒤처지지 않도록 전체 진행 상황을 파악하고 업무 밸런스를 조율한다.' },
  { t: 'C', q: '통보보다 합의 과정을 통해 팀의 심리적 안정감을 구축한다.' },
  { t: 'C', q: '갈등이 생기면 잘잘못보다 서로의 입장 차이를 듣고 타협점을 찾아낸다.' },
  { t: 'E', q: '단기 성과보다 비즈니스 전체를 조망하며 거시적 리스크를 분석한다.' },
  { t: 'E', q: '새 툴·제도 도입 시 직관보다 객관적 근거와 기회비용을 철저히 계산한다.' },
  { t: 'E', q: '팀이 낙관에 치우치면 최악의 시나리오를 가정하고 플랜 B를 마련한다.' },
  { t: 'E', q: '프로세스의 논리적 허점을 찾아내어 안정적인 구조를 설계한다.' },
  { t: 'E', q: '표면을 넘어 시스템 내부의 본질적·구조적 문제를 파고들어 논리적으로 검증한다.' },
] as const;

export const PHIL_LABELS = ['전혀 아님', '아닌 편', '그런 편', '매우 그럼'];

export const PHIL = {
  DD: { type: '니체형 — 가치의 파괴자', name: 'Nietzsche', kr: '프리드리히 니체', era: '1844–1900 · 독일', region: 'german', art: 'p-nietzsche', quote: '나를 죽이지 못하는 것은 나를 더욱 강하게 만든다.', src: '《우상의 황혼》', desc: '누구보다 빠르게 실행하고, 마찰을 뚫고 결과를 만들어냅니다.' },
  DO: { type: '마키아벨리형 — 현실의 전략가', name: 'Machiavelli', kr: '니콜로 마키아벨리', era: '1469–1527 · 이탈리아', region: 'italian', art: 'p-machiavelli', quote: '군주는 사자의 힘과 여우의 지혜를 함께 지녀야 한다.', src: '《군주론》 18장', desc: '실행력과 설득력을 겸비하여 팀을 앞장서 이끕니다.' },
  DE: { type: '베이컨형 — 검증하는 실행가', name: 'Bacon', kr: '프랜시스 베이컨', era: '1561–1626 · 영국', region: 'english', art: 'p-bacon', quote: '아는 것이 힘이다.', src: '《노붐 오르가눔》', desc: '데이터 기반으로 실행 전략을 설계하고 돌파합니다.' },
  OO: { type: '소크라테스형 — 질문하는 안내자', name: 'Socrates', kr: '소크라테스', era: 'BC 470–399 · 그리스', region: 'greek', art: 'p-socrates', quote: '너 자신을 알라.', src: '플라톤 《변명》', desc: '팀의 방향성과 에너지를 만들어내는 핵심 동력입니다.' },
  OD: { type: '장자형 — 이야기의 촉진자', name: 'Zhuangzi', kr: '장자 (莊子)', era: 'BC 369–286 · 중국', region: 'china', art: 'p-zhuangzi', quote: '장주가 나비 꿈을 꾼 것인가, 나비가 장주 꿈을 꾸는 것인가.', src: '《장자》 제물론', desc: '비전을 세우고 즉시 실행으로 연결하는 추진자입니다.' },
  OC: { type: '공자형 — 관계의 조율자', name: 'Confucius', kr: '공자 (孔子)', era: 'BC 551–479 · 중국', region: 'china', art: 'p-confucius', quote: '세 사람이 길을 가면 반드시 나의 스승이 있다.', src: '《논어》 술이편', desc: '관계와 협력을 통해 팀 시너지를 극대화합니다.' },
  CC: { type: '아리스토텔레스형 — 균형의 조율자', name: 'Aristotle', kr: '아리스토텔레스', era: 'BC 384–322 · 그리스', region: 'greek', art: 'p-aristotle', quote: '전체는 부분의 합보다 크다.', src: '《형이상학》', desc: '팀의 균형과 안정감을 책임지는 든든한 중심입니다.' },
  CO: { type: '듀이형 — 공동체의 연결자', name: 'Dewey', kr: '존 듀이', era: '1859–1952 · 미국', region: 'american', art: 'p-dewey', quote: '교육은 삶의 준비가 아니라, 교육 자체가 삶이다.', src: '《민주주의와 교육》', desc: '사람과 사람을 연결하여 협업 네트워크를 완성합니다.' },
  CE: { type: '칸트형 — 원칙의 수호자', name: 'Kant', kr: '임마누엘 칸트', era: '1724–1804 · 독일', region: 'german', art: 'p-kant', quote: '내 위에는 별이 빛나는 하늘, 내 마음속에는 도덕 법칙.', src: '《실천이성비판》', desc: '팀의 프로세스를 지키며 리스크로부터 방어합니다.' },
  EE: { type: '플라톤형 — 본질의 설계자', name: 'Plato', kr: '플라톤', era: 'BC 428–348 · 그리스', region: 'greek', art: 'p-plato', quote: '기하학을 모르는 자, 이 문을 들어오지 말라.', src: '아카데미아 입구 명문', desc: '시스템 전체를 설계하고 논리적 허점을 제거합니다.' },
  ED: { type: '데카르트형 — 분석하는 설계자', name: 'Descartes', kr: '르네 데카르트', era: '1596–1650 · 프랑스', region: 'french', art: 'p-descartes', quote: '나는 생각한다, 고로 나는 존재한다.', src: '《방법서설》', desc: '분석력과 실행력으로 최적의 구조를 구현합니다.' },
  EC: { type: '스피노자형 — 논리의 검증자', name: 'Spinoza', kr: '바뤼흐 스피노자', era: '1632–1677 · 네덜란드', region: 'dutch', art: 'p-spinoza', quote: '모든 고귀한 것은 드문 만큼 어렵다.', src: '《에티카》', desc: '데이터와 협력으로 안전하고 검증된 결론을 도출합니다.' },
} as const;

export type PhilKey = keyof typeof PHIL;

export const PHIL_REGION: Record<string, { accent: string; scene: string; label: string }> = {
  greek:    { accent: '#d4af5a', scene: 'scene-greek',    label: '🇬🇷 GREECE · 신전' },
  german:   { accent: '#7e8db0', scene: 'scene-german',   label: '🇩🇪 GERMANY · 첨탑' },
  italian:  { accent: '#e0654f', scene: 'scene-italian',  label: '🇮🇹 ITALY · 두오모' },
  english:  { accent: '#5aa982', scene: 'scene-english',  label: '🇬🇧 ENGLAND · 칼리지' },
  american: { accent: '#e89048', scene: 'scene-american', label: '🇺🇸 USA · 스카이라인' },
  french:   { accent: '#7488d8', scene: 'scene-french',   label: '🇫🇷 FRANCE · 첨탑' },
  dutch:    { accent: '#e0a64c', scene: 'scene-dutch',    label: '🇳🇱 NETHERLANDS · 풍차' },
  china:    { accent: '#56b690', scene: 'scene-china',    label: '🇨🇳 CHINA · 무릉도원' },
};

export const CODEMAP: Record<string, PhilKey> = {
  DD: 'DD', DO: 'DO', DC: 'DD', DE: 'DE',
  OO: 'OO', OD: 'OD', OC: 'OC', OE: 'OO',
  CC: 'CC', CO: 'CO', CD: 'CC', CE: 'CE',
  EE: 'EE', ED: 'ED', EC: 'EC', EO: 'EE',
};

export const PHIL_ORDER: PhilKey[] = ['DD', 'DO', 'DE', 'OO', 'OD', 'OC', 'CC', 'CO', 'CE', 'EE', 'ED', 'EC'];

export const AX_COLOR: Record<string, string> = {
  D: '#c4453a', O: '#d68a1e', C: '#2f8a72', E: '#5566c2',
};
