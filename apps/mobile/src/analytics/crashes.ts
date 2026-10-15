import { scrubNumbers } from '@kithe/core';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// The DSN is public and send-only. Like analytics, development bundles never report.
const extra = (Constants.expoConfig?.extra ?? {}) as { sentryDsn?: string };
const DSN = __DEV__ ? undefined : extra.sentryDsn;

/** Crash reports with nothing personal: no user, no IP, no console output, no numbers. */
export function installCrashReporting(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb: (crumb) => {
      if (crumb.category === 'console') return null;
      if (crumb.message) crumb.message = scrubNumbers(crumb.message);
      return crumb;
    },
    beforeSend: (event) => {
      delete event.user;
      if (event.message) event.message = scrubNumbers(event.message);
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrubNumbers(exception.value);
      }
      return event;
    },
  });
}

/** Errors caught by the error screen never reach the global handler; report them here. */
export function reportCrash(error: unknown): void {
  if (DSN) Sentry.captureException(error);
}

export const wrapRoot = Sentry.wrap;
