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
  /** @pattern ^foo$ */
  aa: string;
}

export interface BB {
  t: 'b';
  /** @bbuid BB comment */
  aa: number;
}

type AAA = AA | BB;
