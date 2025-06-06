"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BROADCAST_DAY_OPTIONS = exports.STATS_ANIME_TYPE_OPTIONS = exports.ANIME_TYPE_FILTER_OPTIONS = exports.RATING_OPTIONS = exports.USER_ANIME_STATUS_OPTIONS = void 0;
exports.USER_ANIME_STATUS_OPTIONS = [
    { value: 'watching', label: 'Watching' },
    { value: 'completed', label: 'Completed' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'dropped', label: 'Dropped' },
    { value: 'plan_to_watch', label: 'Plan to Watch' },
];
exports.RATING_OPTIONS = [
    { value: 10, label: '10 (Masterpiece)' },
    { value: 9, label: '9 (Great)' },
    { value: 8, label: '8 (Very Good)' },
    { value: 7, label: '7 (Good)' },
    { value: 6, label: '6 (Fine)' },
    { value: 5, label: '5 (Average)' },
    { value: 4, label: '4 (Bad)' },
    { value: 3, label: '3 (Very Bad)' },
    { value: 2, label: '2 (Horrible)' },
    { value: 1, label: '1 (Appalling)' },
];
exports.ANIME_TYPE_FILTER_OPTIONS = [
    { value: 'TV', label: 'TV Series' },
    { value: 'OVA', label: 'OVA' },
    { value: 'ONA', label: 'ONA' },
    { value: 'Movie', label: 'Movie' },
    { value: 'Special', label: 'Special' },
];
exports.STATS_ANIME_TYPE_OPTIONS = [
    ...exports.ANIME_TYPE_FILTER_OPTIONS,
    { value: 'Music', label: 'Music' },
    { value: 'Unknown', label: 'Unknown' },
];
exports.BROADCAST_DAY_OPTIONS = [
    { value: 'Mondays', label: 'Mondays' },
    { value: 'Tuesdays', label: 'Tuesdays' },
    { value: 'Wednesdays', label: 'Wednesdays' },
    { value: 'Thursdays', label: 'Thursdays' },
    { value: 'Fridays', label: 'Fridays' },
    { value: 'Saturdays', label: 'Saturdays' },
    { value: 'Sundays', label: 'Sundays' },
    { value: 'Other', label: 'Other/Unknown' },
];
