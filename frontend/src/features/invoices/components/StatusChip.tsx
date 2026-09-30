import { Chip, type ChipProps } from '@mui/material';
import type { InvoiceStatus } from '../../../api/types';

/**
 * Tinted status chips: semantic colour as a soft background + dark text of the same hue.
 * One style for every status (no filled/outlined mix); all pairs pass WCAG AA contrast.
 */
const TINTS: Record<InvoiceStatus, { bg: string; fg: string }> = {
  Draft: { bg: '#eef0f3', fg: '#344054' },
  Pending: { bg: '#fdf1dc', fg: '#8a4b08' },
  Paid: { bg: '#e3f4ea', fg: '#16623a' },
  Overdue: { bg: '#fde8e7', fg: '#a8231c' },
};

export function StatusChip({
  status,
  size = 'small',
}: {
  status: InvoiceStatus;
  size?: ChipProps['size'];
}) {
  const tint = TINTS[status];
  return (
    <Chip
      label={status}
      size={size}
      sx={{ fontWeight: 600, minWidth: 72, bgcolor: tint.bg, color: tint.fg }}
    />
  );
}
