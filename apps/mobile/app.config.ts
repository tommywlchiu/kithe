import type { ConfigContext, ExpoConfig } from 'expo/config';

// Only development builds may write health data, so the emulator can be seeded with test
// steps. Store builds read only, which keeps the Play health declaration minimal.
// Read-only unless APP_VARIANT=development, which `npm run android` and the EAS development
// profile set. Any other build, local release builds included, cannot write.
const variant = process.env.APP_VARIANT ?? 'production';
const isDevelopmentVariant = variant === 'development';

const HEALTH_CONNECT_READ = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_WHEELCHAIR_PUSHES',
];
const HEALTH_CONNECT_DEV_WRITE = ['android.permission.health.WRITE_STEPS'];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Kithe',
  slug: 'kithe',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'kithe',
  ios: {
    bundleIdentifier: 'com.tommywlchiu.kithe',
    supportsTablet: false,
    icon: './assets/expo.icon',
  },
  android: {
    package: 'com.tommywlchiu.kithe',
    adaptiveIcon: {
      backgroundColor: '#F6F1E7',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      ...HEALTH_CONNECT_READ,
      ...(isDevelopmentVariant ? HEALTH_CONNECT_DEV_WRITE : []),
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F6F1E7',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-sqlite',
    'expo-notifications',
    [
      '@sentry/react-native/expo',
      { url: 'https://sentry.io/', organization: 'marque-studio', project: 'react-native' },
    ],
    'react-native-health-connect',
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'Your pup counts your steps, exercise minutes, and wheelchair pushes to earn Pawprints. Your health data stays on your phone.',
        NSHealthUpdateUsageDescription: false,
        background: false,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 26,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
  ],
  owner: 'tommywlchiu',
  extra: {
    eas: { projectId: 'b6321ccf-10a5-4606-be32-e8f1547d9b4a' },
    // PostHog project key: public and write-only (it can send events, never read them).
    posthogKey: 'phc_ABsmcDCgCgDD6z58eLJcXvcbEUMLKDGFXoyUFkgLf7pq',
    posthogHost: 'https://us.i.posthog.com',
    // Sentry DSN: public and send-only (it can report crashes, never read them).
    sentryDsn:
      'https://0382315851e4052e3d92bf99da0be186@o4512258533687296.ingest.us.sentry.io/4512258535718912',
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
