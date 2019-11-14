export type Mapping<TKey extends string, TValue> = {
  [TKeyType in TKey]: TValue;
};
