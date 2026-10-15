import type { Criterion } from '@suphomey/core';

export const CRITERION_META: Record<Criterion, { chip: string; emoji: string; color: string; mustHint: string }> = {
  mrt: { chip: 'MRT', emoji: '🚇', color: 'var(--sky)', mustHint: 'MRT exit within 800 m' },
  hawker: { chip: 'Hawker', emoji: '🍜', color: 'var(--peach)', mustHint: 'Hawker centre within 1 km' },
  primarySchool: { chip: 'Primary school', emoji: '🎒', color: 'var(--butter)', mustHint: 'A primary school within 1 km' },
  park: { chip: 'Park', emoji: '🌳', color: 'var(--mint)', mustHint: 'Park within 500 m' },
  clinic: { chip: 'Clinic', emoji: '🩺', color: 'var(--lilac)', mustHint: 'CHAS clinic within 800 m' },
  preschool: { chip: 'Preschool', emoji: '🧸', color: 'var(--peach)', mustHint: 'Preschool within 500 m' },
  busStops: { chip: 'Buses', emoji: '🚌', color: 'var(--sky)', mustHint: 'At least 2 bus stops within 400 m' },
  lease: { chip: 'Long lease', emoji: '⏳', color: 'var(--lilac)', mustHint: 'At least 60 years of lease left' },
  budget: { chip: 'Within budget', emoji: '💸', color: 'var(--mint)', mustHint: 'Typical price at or under your budget' },
};
