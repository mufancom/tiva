/* istanbul ignore file */

import {FileWatcher, server, sys} from 'typescript/lib/tsserverlibrary';

const NOOP_FILE_WATCHER: FileWatcher = {
  close() {},
};

export const serverHost: server.ServerHost = {
  ...sys,
  setTimeout,
  clearTimeout,
  setImmediate,
  clearImmediate,
  write() {},
  watchFile() {
    return NOOP_FILE_WATCHER;
  },
  watchDirectory() {
    return NOOP_FILE_WATCHER;
  },
  gc() {
    return global.gc();
  },
};
