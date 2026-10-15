/**
 * The only events Kithe sends, and the only properties each may carry. Anything else is
 * dropped before it leaves the phone: no step counts, exercise minutes, goals, health access,
 * pet name, or email can ever reach analytics (invariant 3).
 */
const ALLOWED = {
  app_installed: [],
  app_opened: [],
  care_action: ['action'],
  diary_opened: [],
  recap_viewed: [],
  recap_shared: [],
  rest_mode_toggled: ['on'],
  notification_opened: [],
  notification_time_set: ['slot'],
  feedback_opened: ['from'],
  $exception: ['$exception_message', '$exception_type'],
} as const satisfies Record<string, readonly string[]>;

export type AnalyticsEventName = keyof typeof ALLOWED;

type PropValue = string | number | boolean;

export type AnalyticsEvent = {
  event: AnalyticsEventName;
  properties: Record<string, PropValue> & { install_day: number; platform: string };
};

/** Context added to every event: days since adoption (for D1, D7, D14 retention) and platform. */
export type AnalyticsContext = { installDay: number; platform: string };

const MAX_STRING = 500;

export function buildEvent(
  event: AnalyticsEventName,
  props: Readonly<Record<string, unknown>>,
  context: AnalyticsContext,
): AnalyticsEvent {
  const allowed: readonly string[] = ALLOWED[event];
  const properties: AnalyticsEvent['properties'] = {
    install_day: Math.max(0, Math.floor(context.installDay)),
    platform: context.platform,
  };
  for (const key of allowed) {
    const value = props[key];
    if (typeof value === 'string') properties[key] = value.slice(0, MAX_STRING);
    else if (typeof value === 'number' && Number.isFinite(value)) properties[key] = value;
    else if (typeof value === 'boolean') properties[key] = value;
  }
  return { event, properties };
}
