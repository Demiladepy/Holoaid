import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface InfoCardProps extends PropsWithChildren {
  title: string;
  caption?: string;
}

export function InfoCard({ title, caption, children }: InfoCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827ee',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  title: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700'
  },
  caption: {
    color: '#9ca3af',
    fontSize: 12
  }
});
