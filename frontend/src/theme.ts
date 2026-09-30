import { alpha, createTheme } from '@mui/material/styles';

/**
 * Design tokens. Calm, trust-first finance UI:
 * - ONE accent (brand navy). Status colours are semantic only and always used as tints.
 * - ONE cool-grey family (slate-like) for surfaces, borders and secondary text.
 * - Off-black text and off-white canvas (no pure #000 / #fff on large surfaces).
 *
 * Shape rule (keep consistent everywhere): containers 12px, controls 8px, status chips 6px.
 */
export const tokens = {
  accent: '#1e4e79',
  accentHover: '#173f63',
  canvas: '#f6f7f9',
  surface: '#ffffff',
  border: '#e4e7ec',
  textPrimary: '#101828',
  textSecondary: '#475467', // 7.4:1 on white, passes WCAG AA for body text
  radius: { container: 12, control: 8, chip: 6 },
};

const FONT_STACK = '"Geist Variable", "Geist", system-ui, -apple-system, "Segoe UI", sans-serif';

export const theme = createTheme({
  palette: {
    primary: { main: tokens.accent, dark: tokens.accentHover },
    // Informational UI (e.g. "session expired") uses the brand accent, not MUI's default cyan.
    info: { main: tokens.accent },
    background: { default: tokens.canvas, paper: tokens.surface },
    text: { primary: tokens.textPrimary, secondary: tokens.textSecondary },
    divider: tokens.border,
  },
  shape: { borderRadius: tokens.radius.control },
  typography: {
    fontFamily: FONT_STACK,
    // Headlines get presence from weight + tight tracking, not raw size.
    h1: { fontSize: '1.625rem', fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.2 },
    h2: { fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 650, letterSpacing: '-0.01em' },
    button: { fontWeight: 600, textTransform: 'none' },
    caption: { letterSpacing: '0.01em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased' },
        // Money and dates line up in columns.
        '.MuiTableCell-root, [data-numeric]': { fontVariantNumeric: 'tabular-nums' },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            transitionDuration: '0.01ms !important',
            animationDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.control,
          transition: 'background-color 150ms ease, transform 100ms ease',
          '&:active': { transform: 'translateY(1px)' }, // tactile press feedback
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${tokens.border}`, borderRadius: tokens.radius.container },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          backgroundColor: alpha(tokens.surface, 0.92),
          backdropFilter: 'saturate(180%) blur(8px)',
          border: 'none',
          borderBottom: `1px solid ${tokens.border}`,
          borderRadius: 0,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:focus-visible': {
            outline: `2px solid ${tokens.accent}`,
            outlineOffset: -2,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { color: tokens.textSecondary, fontWeight: 600, fontSize: '0.8125rem' },
        root: { borderColor: tokens.border },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: tokens.radius.chip } },
    },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: tokens.radius.control } },
    },
  },
});
