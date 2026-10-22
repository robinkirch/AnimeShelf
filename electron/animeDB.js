"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BROADCAST_DAY_OPTIONS = exports.STATS_ANIME_TYPE_OPTIONS = exports.ANIME_TYPE_FILTER_OPTIONS = exports.RATING_OPTIONS = exports.USER_ANIME_STATUS_OPTIONS = void 0;
// Labels for these values are translated in the UI (src/i18n/labels.ts).
exports.USER_ANIME_STATUS_OPTIONS = [
    { value: 'watching' },
    { value: 'completed' },
    { value: 'on_hold' },
    { value: 'dropped' },
    { value: 'plan_to_watch' },
];
exports.RATING_OPTIONS = [
    { value: 10 },
    { value: 9 },
    { value: 8 },
    { value: 7 },
    { value: 6 },
    { value: 5 },
    { value: 4 },
    { value: 3 },
    { value: 2 },
    { value: 1 },
];
exports.ANIME_TYPE_FILTER_OPTIONS = [
    { value: 'TV' },
    { value: 'OVA' },
    { value: 'ONA' },
    { value: 'Movie' },
    { value: 'Special' },
];
exports.STATS_ANIME_TYPE_OPTIONS = [
    ...exports.ANIME_TYPE_FILTER_OPTIONS,
    { value: 'Music' },
    { value: 'Unknown' },
];
exports.BROADCAST_DAY_OPTIONS = [
    { value: 'Mondays' },
    { value: 'Tuesdays' },
    { value: 'Wednesdays' },
    { value: 'Thursdays' },
    { value: 'Fridays' },
    { value: 'Saturdays' },
    { value: 'Sundays' },
    { value: 'Other' },
];
