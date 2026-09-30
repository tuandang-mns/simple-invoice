import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { isCommittableDate } from '../../../lib/format';
import { DateFilterField } from './DateFilterField';

describe('DateFilterField', () => {
  it('commits only the final date while the user types a year (no request per keystroke)', () => {
    const onCommit = vi.fn();
    render(<DateFilterField label="From" value={undefined} onCommit={onCommit} />);
    const input = screen.getByLabelText('From');

    // What Chrome emits while typing 2026 into the year segment:
    for (const v of ['0002-09-01', '0020-09-01', '0202-09-01', '2026-09-01']) {
      fireEvent.change(input, { target: { value: v } });
    }

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('2026-09-01');
    expect(input).toHaveValue('2026-09-01');
  });

  it('commits undefined when the field is cleared', () => {
    const onCommit = vi.fn();
    render(<DateFilterField label="From" value="2026-09-01" onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } });
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it('follows external resets (e.g. Clear filters)', () => {
    const { rerender } = render(
      <DateFilterField label="To" value="2026-09-01" onCommit={vi.fn()} />,
    );
    rerender(<DateFilterField label="To" value={undefined} onCommit={vi.fn()} />);
    expect(screen.getByLabelText('To')).toHaveValue('');
  });

  it.each([
    ['', true],
    ['2026-09-01', true],
    ['0202-09-01', false],
    ['92026-09-01', false],
  ])('isCommittableDate(%j) → %s', (value, expected) => {
    expect(isCommittableDate(value)).toBe(expected);
  });
});
