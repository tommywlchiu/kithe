import { StyleSheet, Text, View } from 'react-native';

export default function DiaryScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>The pup&apos;s diary goes here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F1E7',
    padding: 24,
  },
  text: {
    fontSize: 18,
    color: '#5C4D45',
    textAlign: 'center',
  },
});
