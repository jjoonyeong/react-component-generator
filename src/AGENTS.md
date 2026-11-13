# Module Context

브라우저에서 생성 요청과 결과 상태를 관리하고 API가 반환한 코드를 react-live로 실행한다.

# Tech Stack & Constraints

React 19, react-live 4, TypeScript, Testing Library, Vitest/jsdom. 앱 소스의 타입 제약은 `../tsconfig.app.json`을 따른다.

# Implementation Patterns

- 요청·목록·오류 상태 변경은 `hooks/useComponentGenerator.ts`의 경계를 활용한다. 카드에서는 전달받은 콜백으로 삭제·재생성을 요청한다.
- 앱 UI는 기존 CSS 클래스를 활용한다. AI가 생성하는 코드의 인라인 스타일 제약을 앱 자체의 스타일 규칙으로 확대하지 않는다.

# Testing Strategy

- 루트에서 `bun run test -- src`.
- 사용자 입력 테스트는 `components/PromptInput.test.tsx`처럼 역할 기반 조회와 `userEvent`를 사용한다. DOM 정리는 `test/setup.ts:6`에서 수행한다.
- 기존 테스트는 입력 버튼 상태와 콜백을 검증한다. API 통신·미리보기까지 검증한다고 보고하지 않는다 (`components/PromptInput.test.tsx:6`). 해당 동작 수정 시 필요한 검증을 추가한다.

# Local Golden Rules

- 하드 제약: `LiveProvider`의 `noInline` 모드와 서버의 `render(...)` 출력 계약을 함께 유지한다. 근거: `components/LivePreview.tsx:14`, `../server/generator.ts:16`.
- 이중 방어: 버튼의 disabled만 남기고 제출 핸들러의 빈 입력·로딩 검사를 제거하지 않는다. 단축키도 같은 핸들러를 호출한다. 근거: `components/PromptInput.tsx:25`, `components/PromptInput.tsx:52`, `components/PromptInput.tsx:59`.
- 보안 경계: 제공자를 바꿀 때 수동 API 키를 초기화하는 동작을 유지한다. 근거: `App.tsx:41`.
- 미리보기 새로고침은 API 재요청과 다르다. `previewKey`로 리마운트하는 동작을 보존한다. 근거: `components/ComponentCard.tsx:33`, `components/ComponentCard.tsx:41`, `components/ComponentCard.tsx:70`.
- 생성 시간은 `Date`로 소비된다. 영속화를 도입하면 역직렬화 시 복원한다. 근거: `hooks/useComponentGenerator.ts:39`, `components/ComponentCard.tsx:18`.
