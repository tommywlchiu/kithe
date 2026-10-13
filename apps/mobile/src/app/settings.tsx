import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Rest Mode, notifications, and Tell Tommy go here.</Text>
      {__DEV__ ? (
        <Link href="/dev/movement" style={styles.devLink}>
          Health data spike (dev)
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: '#F6F1E7',
    padding: 24,
  },
  text: {
    fontSize: 18,
    color: '#5C4D45',
    textAlign: 'center',
  },
  devLink: {
    fontSize: 16,
    color: '#C9704A',
    fontWeight: '600',
  },
});
