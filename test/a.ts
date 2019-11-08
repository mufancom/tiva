import {B} from './b';
import * as Path from 'path';

export interface A {
  a: string;
  b: B;
  pia: Path.FormatInputPathObject;
}

export interface MyType {
  /** @uuid @vuid */
  id: string;
  name?: string;
  foo: {
    /** @uuid */
    haha: string;
  }[];
}

export interface AA {
  t: 'a';
  /** @bbuid AA comment */
  aa: string;
  bb?: string;
}

export interface BB {
  t: 'b';
  /** @bbuid BB comment */
  bb: number;
}

export type AAA = AA | BB;
