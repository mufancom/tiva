import {EventEmitter} from 'events';
import * as Path from 'path';
import {Worker} from 'worker_threads';

import {ExtendableError} from 'extendable-error';

import {InitializeRequest, Response, DiagnoseRequest} from './@worker-messages';
import {ValidatorOptions, GeneralValidatorTypeOptions} from './validator';

export interface TivaOptions extends ValidatorOptions {}

export class Tiva extends EventEmitter {
  private worker = new Worker(Path.join(__dirname, '@worker.js'));

  private requestPromiseHandlers: [
    (value: unknown) => void,
    (error: Error) => void,
  ][] = [];

  constructor(options: TivaOptions = {}) {
    super();

    this.worker.on('message', (response: Response) => {
      switch (response.type) {
        case 'initialize':
          this.handleNextRequest(undefined, undefined);
          break;
        case 'diagnose':
          this.handleNextRequest(undefined, response.reasons);
          break;
        case 'error':
          this.handleNextRequest(new Error(response.message), undefined);
          break;
      }
    });

    let initializeRequest: InitializeRequest = {
      type: 'initialize',
      options,
    };

    this.worker.postMessage(initializeRequest);

    this.nextRequest().catch(
      /* istanbul ignore next */
      error => this.emit('error', error),
    );
  }

  async validate(
    type: GeneralValidatorTypeOptions,
    object: unknown,
  ): Promise<void> {
    let messages = await this.diagnose(type, object);

    if (messages) {
      throw new ValidateError(messages);
    }
  }

  async test(
    type: GeneralValidatorTypeOptions,
    object: unknown,
  ): Promise<boolean> {
    return !(await this.diagnose(type, object));
  }

  async diagnose(
    type: GeneralValidatorTypeOptions,
    value: unknown,
  ): Promise<string[] | undefined> {
    let request: DiagnoseRequest = {
      type: 'diagnose',
      typeOptions: type,
      value,
    };

    this.worker.postMessage(request);

    return this.nextRequest();
  }

  private nextRequest<T>(): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestPromiseHandlers.push([resolve, reject]);
    });
  }

  private handleNextRequest(
    error: Error | undefined,
    reasons: string[] | undefined,
  ): void {
    let handlers = this.requestPromiseHandlers.shift();

    /* istanbul ignore else */
    if (handlers) {
      let [resolve, reject] = handlers;

      if (error) {
        reject(error);
      } else {
        resolve(reasons);
      }
    } else {
      if (error) {
        throw error;
      } else {
        throw new Error('Unexpected diagnose response');
      }
    }
  }
}

export class ValidateError extends ExtendableError {
  constructor(readonly diagnostics: string[]) {
    super('Type validation failed');
  }
}
