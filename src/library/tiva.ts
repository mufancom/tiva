import {EventEmitter} from 'events';
import * as Path from 'path';
import {Worker} from 'worker_threads';

import {InitializeRequest, Response, DiagnoseRequest} from './@worker-messages';
import {ValidatorOptions} from './validator';

export interface TivaOptions extends ValidatorOptions {}

export class Tiva extends EventEmitter {
  private worker = new Worker(Path.join(__dirname, '@worker.js'));

  private requestPromiseHandlers: [
    (value: unknown) => void,
    (error: Error) => void,
  ][] = [];

  constructor(options: TivaOptions) {
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

    this.nextRequest().catch(error => this.emit('error', error));
  }

  async validate(type: string, object: unknown): Promise<void> {
    let messages = await this.diagnose(type, object);

    if (messages) {
      throw new Error(messages.join('\n'));
    }
  }

  async test(type: string, object: unknown): Promise<boolean> {
    return !(await this.diagnose(type, object));
  }

  async diagnose(type: string, value: unknown): Promise<string[] | undefined> {
    let request: DiagnoseRequest = {
      type: 'diagnose',
      typeName: type,
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
