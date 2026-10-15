// Sentry's Metro config: the Expo defaults plus debug IDs that match crash stack traces to
// source maps.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
