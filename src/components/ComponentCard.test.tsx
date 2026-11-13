import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ComponentCard } from './ComponentCard';

it('displays code while streaming and switches to preview on completion', () => {
  const props = { component: { id: 'one', prompt: 'card', code: 'render(<div>Finished</div>)', createdAt: new Date() }, onRemove: vi.fn(), onRegenerate: vi.fn(), isLoading: true };
  const view = render(<ComponentCard {...props} isStreaming />);
  expect(screen.getByRole('button', { name: '코드' })).toHaveClass('tab--active');
  expect(screen.queryByText('Finished', { selector: 'div' })).not.toBeInTheDocument();
  view.rerender(<ComponentCard {...props} isLoading={false} isStreaming={false} />);
  expect(screen.getByRole('button', { name: '미리보기' })).toHaveClass('tab--active');
});
