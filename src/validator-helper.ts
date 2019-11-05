import * as Path from 'path';
import {Worker} from 'worker_threads';

/**
 * @property project absolute path
 * @property module absolute path
 */
interface ValidatorHelperConfig {
  project: string;
  module?: string;
  typeName: string;
}

interface CallbackInfo {
  type: number;
  resolve: ((...arg: any[]) => void) | undefined;
  callback: (...arg: any[]) => void;
}

interface BufferInfo extends CallbackInfo {
  obj: object;
}

export class ValidatorHelper {
  /** @internal */
  private static worker: Worker | undefined;

  /** @internal */
  private static callbacksArray: CallbackInfo[] = [];

  /** @internal */
  private static accumulateId = 0;

  /** @internal */
  private static idToValidatorHelperRefMap: Map<
    number,
    ValidatorHelper
  > = new Map();

  /** @internal */
  private initializationHasEnd: boolean;

  /** @internal */
  private initializationSuccess: boolean;

  /** @internal */
  private validatorId: number | undefined;

  /** @internal */
  private validateBuffer: BufferInfo[] | undefined = [];

  /**
   *
   * @param extensionFileName absolute path
   */
  constructor(config: ValidatorHelperConfig, extensionsFileName: string) {
    if (ValidatorHelper.worker === undefined) {
      ValidatorHelper.worker = new Worker(Path.join(__dirname, 'worker.js'));

      ValidatorHelper.worker.on('message', message => {
        if (message.type === 'init-error') {
          let helperId = message.helperId;
          let validatorHelper = ValidatorHelper.idToValidatorHelperRefMap.get(
            helperId,
          )!;

          validatorHelper.initializationHasEnd = true;

          validatorHelper.validateBuffer = undefined;

          ValidatorHelper.idToValidatorHelperRefMap.delete(helperId);

          console.error(`validator initialization error: ${message.errorText}`);

          return;
        }

        if (message.type === 'init-end') {
          let validatorHelper = ValidatorHelper.idToValidatorHelperRefMap.get(
            message.helperId,
          )!;

          validatorHelper.initializationHasEnd = true;

          validatorHelper.initializationSuccess = true;

          validatorHelper.validatorId = message.validatorId;

          validatorHelper.processBuffer();

          validatorHelper.validateBuffer = undefined;

          return;
        }

        if (ValidatorHelper.callbacksArray.length) {
          let {
            type: callbackType,
            resolve,
            callback,
          } = ValidatorHelper.callbacksArray.shift()!;

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

    this.initializationSuccess = false;

    this.initializationHasEnd = false;

    let helperId = this.getNewHelperId();

    ValidatorHelper.idToValidatorHelperRefMap.set(helperId, this);

    ValidatorHelper.worker.postMessage({
      type: 'init',
      config: config,
      extensionsFileName,
      helperId,
    });
  }

  processBuffer(): void {
    for (let bufferInfo of this.validateBuffer!) {
      ValidatorHelper.callbacksArray.push(
        buildCallbackInfo(0, bufferInfo.resolve, bufferInfo.callback),
      );

      this.sendMessage(this.validatorId!, bufferInfo.obj);
    }
  }

  getNewHelperId(): number {
    return ValidatorHelper.accumulateId++;
  }

  sendMessage(validatorId: number, obj: object) {
    ValidatorHelper.worker!.postMessage({
      validatorId,
      obj,
    });
  }

  validate(
    obj: object,
    reject: (...args: any[]) => void,
    resolve?: (...args: any[]) => void,
  ): void {
    if (!this.initializationHasEnd) {
      this.validateBuffer!.push(buildBufferInfo(0, resolve, reject, obj));

      return;
    }

    if (!this.initializationSuccess) {
      return;
    }

    ValidatorHelper.callbacksArray.push(buildCallbackInfo(0, resolve, reject));

    this.sendMessage(this.validatorId!, obj);
  }

  validateAsync(obj: object): Promise<void> {
    return new Promise((resolve, reject) => {
      this.validate(obj, reject, resolve);
    });
  }

  test(obj: object, callback: (arg: boolean) => void): void {
    if (!this.initializationHasEnd) {
      this.validateBuffer!.push(buildBufferInfo(0, undefined, callback, obj));

      return;
    }

    if (!this.initializationSuccess) {
      return;
    }

    ValidatorHelper.callbacksArray.push(
      buildCallbackInfo(1, undefined, callback),
    );

    this.sendMessage(this.validatorId!, obj);
  }

  testAsync(obj: object): Promise<boolean> {
    return new Promise(resolve => {
      this.test(obj, resolve);
    });
  }
}

function buildBufferInfo(
  callbackType: number,
  resolve: ((...arg: any[]) => void) | undefined,
  callback: (...arg: any[]) => void,
  obj: object,
): BufferInfo {
  return {
    type: callbackType,
    resolve,
    callback,
    obj,
  };
}

function buildCallbackInfo(
  callbackType: number,
  resolve: ((...arg: any[]) => void) | undefined,
  callback: (...arg: any[]) => void,
): CallbackInfo {
  return {
    type: callbackType,
    resolve,
    callback,
  };
}
