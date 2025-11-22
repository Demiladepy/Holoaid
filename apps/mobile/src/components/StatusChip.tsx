import { StyleSheet, Text, View } from 'react-native';

interface StatusChipProps {
  label: string;
  tone?: 'neutral' | 'warning' | 'success';
}

const toneColors = {
  neutral: '#14b8a6',
  warning: '#f97316',
  success: '#84cc16'
};

export function StatusChip({ label, tone = 'neutral' }: StatusChipProps) {
  return (
    <View style={[styles.container, { backgroundColor: `${toneColors[tone]}22`, borderColor: toneColors[tone] }]}
      accessibilityRole="text">
      <View style={[styles.dot, { backgroundColor: toneColors[tone] }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  label: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: '600'
  }
});
