import {isUUID} from 'validator';

import {ValidatorExtensions} from './validator';

export interface BuiltInValidatorExtensionContext {
  uuidSet?: Set<string>;
  uniqueSetMap?: Map<string, Set<unknown>>;
}

export const builtInExtensions: ValidatorExtensions<BuiltInValidatorExtensionContext> = {
  pattern(value, pattern) {
    if (typeof value !== 'string') {
      return undefined;
    }

    if (!pattern) {
      throw new Error(
        'A regular expression pattern is required for extension `@pattern`',
      );
    }

    let regex = new RegExp(pattern);

    if (!regex.test(value)) {
      return `Value ${JSON.stringify(value)} does not match pattern ${pattern}`;
    }

    return undefined;
  },
  uuid(value, version: '3' | '4' | '5' | 'all' | undefined, context) {
    if (typeof value !== 'string') {
      return undefined;
    }

    if (!isUUID(value, version)) {
      return `Value ${JSON.stringify(value)} is not a valid UUID${
        version && version !== 'all' ? ` (v${version})` : ''
      }`;
    }

    let {uuidSet} = context;

    if (!uuidSet) {
      uuidSet = context.uuidSet = new Set();
    }

    if (uuidSet.has(value)) {
      return `Duplicate UUID ${JSON.stringify(value)}`;
    }

    uuidSet.add(value);

    return undefined;
  },
  unique(value, tag = '', context) {
    let {uniqueSetMap} = context;

    if (!uniqueSetMap) {
      uniqueSetMap = context.uniqueSetMap = new Map();
    }

    let uniqueSet = uniqueSetMap.get(tag);

    if (!uniqueSet) {
      uniqueSet = new Set();
      uniqueSetMap.set(tag, uniqueSet);
    }

    if (uniqueSet.has(value)) {
      return `Duplicate ${tag || 'value'} ${JSON.stringify(value)}`;
    }

    uniqueSet.add(value);

    return undefined;
  },
};
