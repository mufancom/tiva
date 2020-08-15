export interface Sub {
  /**
   * @unique sub-value
   * @pattern ^\S+$
   */
  value: string;
  /** @unique sub-value */
  value2?: string;
}

export type SubPatterns<T> = T extends object
  ? {
      /**
       * @unique
       * @pattern ^\w+$
       */
      id: string;
    } & Sub
  : never;
