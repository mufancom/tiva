import {SubPatterns, Sub} from './@sub';

export interface Patterns {
  /**
   * @pattern @\w+
   */
  mention: string;

  /**
   * @pattern ^\d+$
   */
  number: string;

  /** @custom */
  custom: string;

  subs: SubPatterns<Sub>[];
}
