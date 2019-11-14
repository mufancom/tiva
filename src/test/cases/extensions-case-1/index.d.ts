interface InvalidPatterns {
  /**
   * @pattern
   */
  xxx: string;
}

interface Patterns {
  /**
   * @pattern @\w+
   */
  mention: string;

  /**
   * @pattern ^\d+$
   */
  number: string;

  /**
   * @pattern ^\d+$
   */
  maybeNumber: string | number;

  /**
   * @uuid */
  uuid: string;

  /** @uuid */
  maybeUUID: string | number;

  /**
   * @uuid all
   */
  uuidAll: string;

  /**
   * @uuid 4
   */
  uuid4: string;
}
