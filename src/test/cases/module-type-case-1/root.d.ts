import {Conditional} from './conditional';
import {Mapping} from './mapping';

export interface Root {
  conditional: Conditional<object>;
  mapping: Mapping<'hello' | 'world', boolean>;
  array: string[];
  tuple: [string, boolean, 'literal'];
}
