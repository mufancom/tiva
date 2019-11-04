import * as Path from 'path';
import {Worker} from 'worker_threads';

export class ValidatorHelper {
  /** @internal */
  private static worker: Worker | undefined;

  /** @internal */
  private initializationSuccessed: boolean;

  /** @internal */
  private static callbacksArray: ([
    number,
    ((...arg: any[]) => void) | undefined,
    (...arg: any[]) => void,
  ])[] = [];

  readonly configFileName: string;

  /**
   *
   * @param configFileName absolute path
   */
  constructor(configFileName: string) {
    this.configFileName = configFileName;

    if (ValidatorHelper.worker === undefined) {
      ValidatorHelper.worker = new Worker(Path.join(__dirname, 'worker.js'));

      ValidatorHelper.worker.on('message', message => {
        if (!this.initializationSuccessed) {
          return;
        }

        if (message.type === 'init-error') {
          this.initializationSuccessed = false;

          console.error(`validator initialization error: ${message.errorText}`);

          return;
        }

        if (ValidatorHelper.callbacksArray.length) {
          let [
            callbackType,
            resolve,
            callback,
          ] = ValidatorHelper.callbacksArray.shift()!;

          if (callbackType === 0) {
            if (message.type === 'error') {
              callback(message.errorText);
            } else {
              if (resolve) {
                resolve();
              }
            }
          } else {
            if (message.type === 'success') {
              callback(true);
            } else {
              callback(false);
            }
          }
        } else {
          console.error("Unexpected message from 'validator'");
        }
      });
    }

    this.initializationSuccessed = true;

    ValidatorHelper.worker.postMessage({
      type: 'init',
      configFileName,
    });
  }

  validate(
    obj: object,
    reject: (...args: any[]) => void,
    resolve?: (...args: any[]) => void,
  ): void {
    if (!this.initializationSuccessed) {
      return;
    }

    ValidatorHelper.callbacksArray.push([0, resolve, reject]);

    ValidatorHelper.worker!.postMessage({
      type: 'validate',
      configFileName: this.configFileName,
      obj: obj,
    });
  }

  validateAsync(obj: object): Promise<void> {
    return new Promise((resolve, reject) => {
      this.validate(obj, reject, resolve);
    });
  }

  test(obj: object, callback: (arg: boolean) => void): void {
    if (!this.initializationSuccessed) {
      return;
    }

    ValidatorHelper.callbacksArray.push([1, undefined, callback]);

    ValidatorHelper.worker!.postMessage({
      type: 'test',
      configFileName: this.configFileName,
      obj: obj,
    });
  }

  testAsync(obj: object): Promise<boolean> {
    return new Promise(resolve => {
      this.test(obj, resolve);
    });
  }
}

const validatorHelper = new ValidatorHelper(
  Path.resolve(__dirname, '../test/config.js'),
);

validatorHelper.validate(
  {
    t: 'b',
    aa: 4,
  },
  message => {
    console.log('caller rejcet: ' + message.toString());
  },
  message => {
    console.log('caller resolve: ' + message);
  },
);

const validatorHelper2 = new ValidatorHelper(
  Path.resolve(__dirname, '../test/config.js'),
);

validatorHelper2.validate(
  {
    t: 'b',
    aa: 2,
  },
  message => {
    console.log('caller rejcet 2: ' + message.toString());
  },
  message => {
    console.log('caller resolve 2: ' + message);
  },
);

validatorHelper.validate(
  {
    t: 'b',
    aa: 3,
  },
  message => {
    console.log('caller rejcet 3: ' + message.toString());
  },
  message => {
    console.log('caller resolve 3: ' + message);
  },
);

validatorHelper2.validate(
  {
    t: 'b',
    aa: 1,
  },
  message => {
    console.log('caller rejcet 1: ' + message.toString());
  },
  message => {
    console.log('caller resolve 1: ' + message);
  },
);
