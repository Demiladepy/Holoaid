import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface AssistiveButtonProps {
  label: string;
  description?: string;
  icon?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
}

export function AssistiveButton({
  label,
  description,
  icon,
  onPress,
  onLongPress,
  disabled,
  tone = 'primary'
}: AssistiveButtonProps) {
  const accessibilityLabel = description ? `${label}. ${description}` : label;
  const isSecondary = tone === 'secondary';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: '#ffffff22' }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={description}
      disabled={disabled}
    >
      <View style={styles.content}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.textGroup}>
          <Text style={styles.label}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  primary: {
    backgroundColor: '#111827'
  },
  secondary: {
    backgroundColor: '#1f2937'
  },
  pressed: {
    opacity: 0.8
  },
  disabled: {
    opacity: 0.5
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  icon: {
    marginRight: 16
  },
  textGroup: {
    flex: 1
  },
  label: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: '600'
  },
  description: {
    color: '#d1d5db',
    fontSize: 14,
    marginTop: 2
  }
});
