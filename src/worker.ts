import * as Path from 'path';
import * as FS from 'fs';

import {Validator, ValidatorConfigOptions} from './validator';

import {parentPort} from 'worker_threads';

let validators: Validator[] = [];

parentPort!.on('message', message => {
  if (message.type === 'init') {
    try {
      let extensions = require(message.extensionsFileName);
      let config = message.config;

      let projectIsDirectory = FS.lstatSync(config.project).isDirectory();
      let validatorConfig: ValidatorConfigOptions = {
        module: config.module,
        typeName: config.typeName,
        optionsFileName: projectIsDirectory
          ? Path.resolve(__dirname, '../assets/default-tsconfig.json')
          : config.project,
        projectPath: projectIsDirectory
          ? config.project
          : Path.dirname(config.project),
        extensions: extensions,
      };

      validators.push(new Validator(validatorConfig));

      parentPort!.postMessage({
        type: 'init-end',
        validatorId: validators.length - 1,
        helperId: message.helperId,
      });
    } catch (e) {
      parentPort!.postMessage({
        type: 'init-error',
        helperId: message.helperId,
        errorText: e.toString(),
      });
    }
  } else {
    let id = message.validatorId;

    if (!isNumber(id) || id < 0 || id >= validators.length) {
      parentPort!.postMessage({
        type: 'error',
        validatorId: id,
        errorText: "Perhaps you haven't initialized the validator",
      });

      return;
    }

    try {
      validators[id].validate(message.obj);

      parentPort!.postMessage({
        type: 'success',
        validatorId: id,
      });
    } catch (e) {
      parentPort!.postMessage({
        type: 'error',
        validatorId: id,
        errorText: e.toString(),
      });
    }
  }
});

function isNumber(value: any) {
  return typeof value === 'number' && isFinite(value);
}
