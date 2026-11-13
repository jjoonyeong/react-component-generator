# Module Context

Bun HTTP 서버가 외부 AI 제공자를 호출하고 응답을 브라우저 미리보기용 코드로 정규화한다.

# Tech Stack & Constraints

Bun 런타임, TypeScript, 내장 fetch. `index.ts`를 import하면 `Bun.serve`가 실행된다 (`index.ts:138`).

# Implementation Patterns

- 제공자별 응답 파싱은 각 호출 함수에 둔다. 공통 코드 정규화는 `generator.ts`, 순차 모델 시도는 `fallback.ts`의 순수 함수 경계를 유지한다.
- 성공 응답은 `{ code }`, 실패 응답은 `{ error }`를 사용해 클라이언트 소비 계약을 유지한다 (`index.ts:190`, `index.ts:208`, `../src/hooks/useComponentGenerator.ts:29`).

# Testing Strategy

- 루트에서 `bun run test -- server`.
- `generator.test.ts`는 정규화 계약을, `fallback.test.ts`는 성공·실패·빈 목록 동작을 검증한다. 실제 외부 API나 HTTP 라우트 검증과 구분한다.
- 순수 함수 테스트에서 서버 진입점을 import하지 않는다. 제공자 호출을 검증할 때 실제 유료 요청 대신 fetch 대역을 사용한다.

# Local Golden Rules

- 비대칭: Gemini에만 모델 순차 폴백과 `MAX_TOKENS` 잘림 처리가 있다. 제공자 코드를 통합할 때 이 처리를 잃지 않는다. 근거: `index.ts:123`, `index.ts:134`; Anthropic 경로는 `index.ts:68`.
- 이중 방어: 프롬프트의 출력 형식 지시만 믿고 코드펜스 제거·render 호출 보정을 삭제하지 않는다. 정규화 순서는 `ensureRenderCall(stripCodeFences(text))`다. 근거: `index.ts:12`, `index.ts:16`, `index.ts:188`.
- 하드 제약: 생성 결과는 import나 TypeScript 구문 없는 독립 JavaScript/JSX이며 `render(...)`로 끝나야 한다. 앱 소스가 TypeScript라는 이유로 출력 계약을 바꾸지 않는다. 근거: `index.ts:10`, `index.ts:20`, `../src/components/LivePreview.tsx:14`.
- 키 우선순위는 수동 키, 서버 환경 키 순이다. 환경 키가 존재해도 수동 입력을 무시하지 않는다. 근거: `index.ts:64`.
- 폴백은 첫 성공에서 종료하고 전체 실패 시 마지막 오류를 던진다. 병렬 호출로 변경하지 않는다. 근거: `fallback.ts:12`, `fallback.ts:19`, `fallback.test.ts:5`, `fallback.test.ts:27`.
