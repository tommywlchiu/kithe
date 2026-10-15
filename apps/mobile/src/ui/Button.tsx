import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, space } from './theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'quiet';
  disabled?: boolean;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  accessibilityHint,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.quiet,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text style={variant === 'primary' ? styles.primaryText : styles.quietText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.terracotta },
  quiet: { backgroundColor: colors.cream, borderWidth: 2, borderColor: colors.line },
  dim: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  quietText: { color: colors.ink, fontSize: 17, fontWeight: '600' },
});
