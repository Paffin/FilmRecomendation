export enum SignalGroup {
  Core = 'core',
  Content = 'content',
  Creative = 'creative',
  Context = 'context',
  Novelty = 'novelty',
  Diversity = 'diversity',
  Anti = 'anti',
  Runtime = 'runtime',
}

export const inferSignalGroup = (key: string): SignalGroup => {
  if (
    key === 'rating' ||
    key === 'popularity' ||
    key === 'freshness' ||
    key === 'recency' ||
    key === 'similarity'
  ) {
    return SignalGroup.Core;
  }

  if (
    key.startsWith('genre:') ||
    key.startsWith('country:') ||
    key.startsWith('decade:') ||
    key.startsWith('lang:') ||
    key.startsWith('keyword:') ||
    key.startsWith('collection:')
  ) {
    return SignalGroup.Content;
  }

  if (key.startsWith('person:')) {
    return SignalGroup.Creative;
  }

  if (
    key === 'mood' ||
    key === 'mindset' ||
    key === 'company' ||
    key === 'context_mood_light' ||
    key === 'context_mood_neutral' ||
    key === 'context_mood_heavy' ||
    key === 'context_company_solo' ||
    key === 'context_company_duo' ||
    key === 'context_company_friends' ||
    key === 'context_company_family'
  ) {
    return SignalGroup.Context;
  }

  if (key === 'novelty') {
    return SignalGroup.Novelty;
  }

  if (key === 'diversity') {
    return SignalGroup.Diversity;
  }

  if (key === 'anti') {
    return SignalGroup.Anti;
  }

  if (
    key === 'runtimeFit' ||
    key === 'pace' ||
    key === 'ageRatingFit' ||
    key === 'runtime_bucket_short' ||
    key === 'runtime_bucket_medium' ||
    key === 'runtime_bucket_long'
  ) {
    return SignalGroup.Runtime;
  }

  return SignalGroup.Core;
};

