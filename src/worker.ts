import * as Path from 'path';

import {Validator, ValidatorConfigOptions} from './validator';

import {parentPort} from 'worker_threads';

let configFileNameToValidatorMap: Map<string, Validator> = new Map();

parentPort!.on('message', message => {
  if (message.type === 'init') {
    if (configFileNameToValidatorMap.has(message.configFileName)) {
      return;
    }

    try {
      let configFileName = message.configFileName;
      let config = require(configFileName) as ValidatorConfigOptions;
      let projectPath = Path.dirname(configFileName);

      config.fileName = Path.resolve(projectPath, config.fileName);

      config.project = Path.resolve(projectPath, config.project);

      configFileNameToValidatorMap.set(configFileName, new Validator(config));
    } catch (e) {
      parentPort!.postMessage({
        type: 'init-error',
        errorText: e.toString(),
      });
    }
  } else {
    if (!configFileNameToValidatorMap.has(message.configFileName)) {
      parentPort!.postMessage({
        type: 'error',
        errorText: "Perhaps you haven't initialized the validator",
      });

      return;
    }

    try {
      configFileNameToValidatorMap
        .get(message.configFileName)!
        .validate(message.obj);

      parentPort!.postMessage({
        type: 'success',
      });
    } catch (e) {
      parentPort!.postMessage({
        type: 'error',
        errorText: e.toString(),
      });
    }
  }
});
