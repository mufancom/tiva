export type Conditional<T> = T extends object
  ? {
      conditionLeft: string;
    }
  : {
      conditionRight: number;
    };
