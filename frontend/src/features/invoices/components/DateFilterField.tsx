import { TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { isCommittableDate } from '../../../lib/format';

interface Props {
  label: string;
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
  min?: string;
  max?: string;
}

/**
 * Native date input for list filters.
 *
 * While the user types a year, browsers emit intermediate "valid" dates
 * (0002-09-01 → 0020-09-01 → 0202-09-01 → 2026-09-01). Wiring the input straight
 * to the URL would fire a request per keystroke and could reset the field mid-typing.
 * So the field keeps its own state and only commits complete, plausible dates.
 */
export function DateFilterField({ label, value, onCommit, min, max }: Props) {
  const [draft, setDraft] = useState(value ?? '');

  // Follow external changes (Clear filters, back/forward navigation).
  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  return (
    <TextField
      type="date"
      label={label}
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (isCommittableDate(next) && next !== (value ?? '')) {
          onCommit(next || undefined);
        }
      }}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { min, max } }}
    />
  );
}
