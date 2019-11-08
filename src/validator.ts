import * as _ from 'lodash';
import {ProjectServiceHelper} from './project-service-helper';

export type ExtensionsType = {[key: string]: Function};

export interface ValidatorConfigOptions {
  optionsFileName: string;
  projectPath: string;
  module: string | undefined;
  typeName: string;
  extensions?: ExtensionsType;
}

export class Validator {
  /** @internal */
  private static projectServiceHelper: ProjectServiceHelper;

  private config: ValidatorConfigOptions;

  constructor(validatorConfigOptions: ValidatorConfigOptions) {
    if (validatorConfigOptions.typeName === undefined) {
      throw new Error('type name is not specified');
    }

    this.config = validatorConfigOptions;

    if (!Validator.projectServiceHelper) {
      Validator.projectServiceHelper = new ProjectServiceHelper();
    }
  }

  validate(obj: object) {
    Validator.projectServiceHelper.validate(this.config, obj);
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
