import { Text as RNText, type TextProps } from 'react-native';

import { colors, font } from '@/shared/theme/tokens';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'caption' | 'mono';

const variants = {
  title: { fontSize: font.size.xxl, fontWeight: '800', color: colors.ink },
  heading: { fontSize: font.size.lg, fontWeight: '800', color: colors.ink },
  body: { fontSize: font.size.base, fontWeight: '400', color: colors.ink },
  label: { fontSize: font.size.sm, fontWeight: '600', color: colors.gray },
  caption: { fontSize: font.size.sm, fontWeight: '400', color: colors.gray },
  mono: { fontSize: font.size.sm, fontFamily: font.mono, color: colors.ink },
} as const;

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText {...rest} style={[variants[variant], style]} />;
}
