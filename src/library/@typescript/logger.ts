/* istanbul ignore file */

import {server} from 'typescript/lib/tsserverlibrary';

export const logger: server.Logger = {
  close() {},
  loggingEnabled() {
    return false;
  },
  hasLevel() {
    return false;
  },
  perftrc() {},
  info() {},
  startGroup() {},
  endGroup() {},
  getLogFileName() {
    return '';
  },
  msg() {},
};
