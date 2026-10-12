import { economy } from '@kithe/content';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>Kithe</Text>
        <Text style={styles.subtitle}>The pup&apos;s room goes here.</Text>
        <Text style={styles.meta}>
          economy v{economy.version} · {economy.earnings.atGoal} Pawprints at goal
        </Text>
        <View style={styles.links}>
          <Link href="/diary" style={styles.link}>
            Diary
          </Link>
          <Link href="/settings" style={styles.link}>
            Settings
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F1E7',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#3B2F2A',
  },
  subtitle: {
    fontSize: 18,
    color: '#5C4D45',
    textAlign: 'center',
  },
  meta: {
    fontSize: 13,
    color: '#8A7A70',
  },
  links: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 24,
  },
  link: {
    fontSize: 18,
    color: '#C9704A',
    fontWeight: '600',
  },
});
