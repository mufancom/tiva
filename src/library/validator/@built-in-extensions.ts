import Validator from 'validator';

import {ValidatorExtensions} from './validator';

export interface BuiltInValidatorExtensionContext {
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
  uuid(value, version: '3' | '4' | '5' | 'all' | undefined) {
    if (typeof value !== 'string') {
      return undefined;
    }

    if (!Validator.isUUID(value, version)) {
      return `Value ${JSON.stringify(value)} is not a valid UUID${
        version && version !== 'all' ? ` (v${version})` : ''
      }`;
    }

    return undefined;
  },
  unique(value, group, context, tagUniqueId) {
    let groupName = group || 'value';

    if (!group) {
      group = tagUniqueId;
    }

    let {uniqueSetMap} = context;

    if (!uniqueSetMap) {
      uniqueSetMap = context.uniqueSetMap = new Map();
    }

    let uniqueSet = uniqueSetMap.get(group);

    if (!uniqueSet) {
      uniqueSet = new Set();
      uniqueSetMap.set(group, uniqueSet);
    }

    if (uniqueSet.has(value)) {
      return `Duplicate ${groupName} ${JSON.stringify(value)}`;
    }

    uniqueSet.add(value);

    return undefined;
  },
};
