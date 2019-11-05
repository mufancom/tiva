import * as _ from 'lodash';

import {LanguageServiceHelper} from './language-service-helper';

export interface ValidatorConfigOptions {
  optionsFileName: string;
  projectPath: string;
  module: string | undefined;
  typeName: string;
  extensions?: {[key: string]: Function};
}

export class Validator {
  /** @internal */
  private static optionsPathTolanguageServiceHelperMap: Map<
    string,
    LanguageServiceHelper
  > = new Map();

  /** @internal */
  private optionsPath: string;

  /** @internal */
  private fileId: number;

  constructor(validatorConfigOptions: ValidatorConfigOptions) {
    const config = validatorConfigOptions;
    const optionsPath = (this.optionsPath = config.optionsFileName);

    if (config.typeName === undefined) {
      throw new Error('type name is not specified');
    }

    if (!Validator.optionsPathTolanguageServiceHelperMap.has(optionsPath)) {
      Validator.optionsPathTolanguageServiceHelperMap.set(
        optionsPath,
        new LanguageServiceHelper(config.projectPath, optionsPath),
      );
    }

    let languageServiceHelper = Validator.optionsPathTolanguageServiceHelperMap.get(
      optionsPath,
    )!;

    this.fileId = languageServiceHelper.add(
      config.module,
      config.typeName,
      config.extensions,
    );
  }

  validate(obj: object) {
    Validator.optionsPathTolanguageServiceHelperMap
      .get(this.optionsPath)!
      .validate(this.fileId, obj);
  }

  test(obj: object): boolean {
    try {
      this.validate(obj);
      return true;
    } catch (e) {
      return false;
    }
  }
}
