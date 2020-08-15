import {parentPort} from 'worker_threads';

import {
  DiagnoseResponse,
  ErrorResponse,
  InitializeResponse,
  Request,
} from './@worker-messages';
import {Validator} from './validator';

let validator!: Validator;

parentPort!.on('message', (request: Request) => {
  try {
    switch (request.type) {
      case 'initialize': {
        validator = new Validator(request.options);

        let response: InitializeResponse = {
          type: 'initialize',
        };

        parentPort!.postMessage(response);

        break;
      }

      case 'diagnose': {
        let reasons = validator.diagnose(request.typeOptions, request.value);

        let response: DiagnoseResponse = {
          type: 'diagnose',
          reasons,
        };

        parentPort!.postMessage(response);

        break;
      }
    }
  } catch (error) {
    let response: ErrorResponse = {
      type: 'error',
      message: error.message,
    };

    parentPort!.postMessage(response);
  }
});
