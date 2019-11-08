import {server, FileWatcher} from 'typescript/lib/tsserverlibrary';

import {
  LanguageService,
  flattenDiagnosticMessageText,
  TypeChecker,
  VariableStatement,
  Node,
  isTypeReferenceNode,
  isTypeAliasDeclaration,
  isUnionTypeNode,
  isIntersectionTypeNode,
  isInterfaceDeclaration,
  isTypeLiteralNode,
  isClassDeclaration,
  isObjectLiteralExpression,
  isPropertySignature,
  isPropertyAssignment,
  isPropertyDeclaration,
  getJSDocTags,
  isArrayTypeNode,
  isArrayLiteralExpression,
  isImportSpecifier,
  isConditionalTypeNode,
  isMappedTypeNode,
  PropertyAssignment,
} from 'typescript';
import * as ts from 'typescript';
import * as FS from 'fs';
import {ValidatorConfigOptions, ExtensionsType} from './validator';

export class ProjectServiceHelper {
  private projectService: server.ProjectService;

  private languageService: LanguageService | undefined;

  private typeChecker: TypeChecker | undefined;

  private extensions: ExtensionsType | undefined;

  private validatingNode: Node | undefined;

  private typeStringsInStack: Set<string> | undefined;

  private extensionsValidateStatus: boolean | undefined;

  constructor() {
    this.projectService = createProjectService();
  }

  validate(config: ValidatorConfigOptions, obj: object) {
    let json = JSON.stringify(obj);
    const fileName = config.module!; // TODO

    let content = FS.readFileSync(fileName);

    this.projectService.openClientFile(
      fileName,
      `${content}\nexport const ____aaaa: ${config.typeName} = ${json};`,
      ts.ScriptKind.Deferred,
      config.projectPath,
    );

    try {
      let project = this.projectService.getDefaultProjectForFile(
        server.toNormalizedPath(fileName),
        true,
      );

      if (!project) {
        throw new Error('Project Not Found.');
      }

      let languageService = (this.languageService = project.getLanguageService());

      let diagnostics = [
        ...languageService.getSyntacticDiagnostics(fileName),
        ...languageService.getSemanticDiagnostics(fileName),
      ];

      if (diagnostics.length) {
        throw new Error(
          `errors detected: type: ${
            config.typeName
          }, object: ${json}\n${diagnostics.map(diagnostic =>
            flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          )}\n`,
        );
      } else {
        let program = languageService.getProgram()!;
        let sourceFile = program.getSourceFile(fileName);

        if (!sourceFile) {
          throw new Error('sourceFile is undefined');
        }

        this.typeChecker = program.getTypeChecker();

        if (config.extensions && typeof config.extensions === 'object') {
          let node = sourceFile.statements[
            sourceFile.statements.length - 1
          ] as VariableStatement;
          let declaration = node.declarationList.declarations[0];

          this.extensions = config.extensions;

          if (!declaration.initializer) {
            throw new Error("Your haven't passed a valid object");
          }

          this.validatingNode = declaration.initializer;

          this.typeStringsInStack = new Set();

          this.extensionsValidateStatus = true;

          this.extensionsValidate(declaration.type!);

          if (!this.extensionsValidateStatus) {
            throw new Error(
              `extension validate failed:\ntype: ${declaration.type!.getText()}\ninitializer: ${declaration.initializer!.getText()}\n`,
            );
          }
        }
      }
    } catch (e) {
      throw e;
    } finally {
      this.projectService.closeClientFile(fileName);
    }
  }

  /** @internal */
  private extensionsValidate = (type: Node | undefined): void => {
    if (type === undefined) {
      return;
    }

    if (isTypeReferenceNode(type)) {
      let symbol = this.typeChecker!.getSymbolAtLocation(type.typeName);
      let typeString = `${type.getText()}${
        type.getSourceFile().fileName
      }${type.getStart()}${type.getEnd()}`;

      if (this.typeStringsInStack!.has(typeString)) {
        return;
      }

      this.typeStringsInStack!.add(typeString);

      let result = true;

      if (symbol) {
        for (let declaration of symbol.declarations) {
          this.extensionsValidate(declaration);
        }
      } else {
        throw new Error('symbol is undefined');
      }

      if (type.typeArguments) {
        for (let typeArgument of type.typeArguments) {
          this.extensionsValidate(typeArgument);
        }
      }

      this.typeStringsInStack!.delete(typeString);
    } else if (isTypeAliasDeclaration(type)) {
      return this.extensionsValidate(type.type);
    } else if (isUnionTypeNode(type)) {
      for (let typeNode of type.types) {
        this.extensionsValidate(typeNode);
      }
    } else if (isIntersectionTypeNode(type)) {
      for (let childType of type.types) {
        this.extensionsValidate(childType);
      }
    } else if (
      isInterfaceDeclaration(type) ||
      isTypeLiteralNode(type) ||
      isClassDeclaration(type)
    ) {
      for (let i = 0; i < type.members.length; ++i) {
        let typePropertyName = type.members[i].name;

        if (typePropertyName) {
          this.extensionsValidate(type.members[i]);
        }
      }
    } else if (isPropertySignature(type) || isPropertyDeclaration(type)) {
      let nodes = this.findNodesByType(type);

      if (nodes.length === 0) {
        return;
      }

      let tags = getJSDocTags(type);

      if (tags) {
        for (let tag of tags) {
          let validateFunction = this.extensions![tag.tagName.getText()];

          if (validateFunction) {
            for (let node of nodes) {
              if (
                !validateFunction(
                  JSON.parse(node.initializer.getText()),
                  tag.comment,
                )
              ) {
                this.extensionsValidateStatus = false;
                return;
              }
            }
          }
        }
      }

      if (type.type) {
        this.extensionsValidate(type.type);
      }
    } else if (isArrayTypeNode(type)) {
      return this.extensionsValidate(type.elementType);
    } else if (isImportSpecifier(type)) {
      let importSpecifierCorrespondingSymbol;

      if (type.propertyName) {
        importSpecifierCorrespondingSymbol = this.typeChecker!.getSymbolAtLocation(
          type.propertyName,
        );
      } else {
        let symbol = this.typeChecker!.getSymbolAtLocation(type.name);

        if (!symbol) {
          return;
        }

        importSpecifierCorrespondingSymbol =
          this.typeChecker!.getTypeAtLocation(type).getSymbol() ||
          this.typeChecker!.getDeclaredTypeOfSymbol(symbol).getSymbol() ||
          this.typeChecker!.getAliasedSymbol(symbol);
      }

      for (let declaration of importSpecifierCorrespondingSymbol!
        .declarations) {
        this.extensionsValidate(declaration);
      }
    } else if (isConditionalTypeNode(type)) {
      this.extensionsValidate(type.trueType);
      this.extensionsValidate(type.falseType);
    } else if (isMappedTypeNode(type)) {
      this.extensionsValidate(type.typeParameter);
      this.extensionsValidate(type.type);
    }
  };

  findNodesByType(
    type: ts.PropertySignature | ts.PropertyDeclaration,
  ): PropertyAssignment[] {
    let references = this.languageService!.getReferencesAtPosition(
      type.getSourceFile().fileName,
      type.name.getStart(),
    );

    let nodes: PropertyAssignment[] = [];

    if (!references) {
      return [];
    }

    let start = this.validatingNode!.getStart();
    let end = this.validatingNode!.getEnd();

    for (let reference of references) {
      let contextSpan = reference.contextSpan;

      if (contextSpan) {
        if (
          contextSpan.start >= start &&
          contextSpan.start + contextSpan.length <= end
        ) {
          // TODO: check above
          let node = findNodeByRange(
            this.validatingNode!,
            contextSpan.start,
            contextSpan.start + contextSpan.length,
          );

          if (node) {
            nodes.push(node);
          }
        }
      }
    }

    return nodes;
  }
}

function findNodeByRange(
  node: Node,
  start: number,
  end: number,
): PropertyAssignment | undefined {
  if (node.getStart() >= start && node.getEnd() <= end) {
    if (isPropertyAssignment(node)) {
      return node;
    } else {
      return undefined;
    }
  }

  if (isObjectLiteralExpression(node)) {
    for (let property of node.properties) {
      if (property.getStart() <= start && property.getEnd() >= end) {
        return findNodeByRange(property, start, end);
      }
    }
  } else if (isArrayLiteralExpression(node)) {
    for (let element of node.elements) {
      if (element.getStart() <= start && element.getEnd() >= end) {
        return findNodeByRange(element, start, end);
      }
    }
  } else if (isPropertyAssignment(node)) {
    return findNodeByRange(node.initializer, start, end);
  }

  return undefined;
}

function createProjectService() {
  function noop(_?: {} | null | undefined): void {}

  class Logger implements server.Logger {
    // eslint-disable-line @typescript-eslint/no-unnecessary-qualifier
    private fd = -1;

    constructor(
      private readonly logFilename: string,
      private readonly traceToConsole: boolean,
      private readonly level: server.LogLevel,
    ) {
      if (this.logFilename) {
        try {
          this.fd = FS.openSync(this.logFilename, 'w');
        } catch (_) {
          // swallow the error and keep logging disabled if file cannot be opened
        }
      }
    }

    close() {
      if (this.fd >= 0) {
        FS.close(this.fd, noop);
      }
    }

    loggingEnabled() {
      return !!this.logFilename || this.traceToConsole;
    }

    hasLevel(level: server.LogLevel) {
      return this.loggingEnabled() && this.level >= level;
    }

    perftrc(s: string) {
      this.msg(s, server.Msg.Perf);
    }

    info(s: string) {
      this.msg(s, server.Msg.Info);
    }

    startGroup() {}

    endGroup() {}

    getLogFileName() {
      return this.logFilename;
    }

    msg(_s: string, _type: server.Msg = server.Msg.Err) {
      // console.log(`type ${type.toString()}: ${s.toString()}`); // TODO: swallow
    }
  }

  const sys = ts.sys as server.ServerHost;
  sys.setTimeout = setTimeout;
  sys.clearTimeout = clearTimeout;
  sys.setImmediate = setImmediate;
  sys.clearImmediate = clearImmediate;
  sys.watchDirectory = watchDirectorySwallowingException;

  if (typeof global !== 'undefined' && global.gc) {
    sys.gc = () => global.gc();
  }

  const Buffer: {
    new (input: string, encoding?: string): any;
    from?(input: string, encoding?: string): any;
  } = require('buffer').Buffer;

  function bufferFrom(input: string, encoding?: string): Buffer {
    // See https://github.com/Microsoft/TypeScript/issues/25652
    return Buffer.from && (Buffer.from as Function) !== Int8Array.from
      ? Buffer.from(input, encoding)
      : new Buffer(input, encoding);
  }
  const pollingWatchedFileSet = createPollingWatchedFileSet();
  sys.write = (s: string) => writeMessage(bufferFrom!(s, 'utf8'));
  sys.watchFile = (fileName: string, callback: any) => {
    const watchedFile = pollingWatchedFileSet.addFile(fileName, callback);
    return {
      close: () => pollingWatchedFileSet.removeFile(watchedFile),
    };
  };

  const pending: Buffer[] = [];
  let canWrite = true;

  function setCanWriteFlagAndWriteMessageIfNecessary() {
    canWrite = true;
    if (pending.length) {
      writeMessage(pending.shift()!);
    }
  }

  function writeMessage(buf: Buffer) {
    if (!canWrite) {
      pending.push(buf);
    } else {
      canWrite = false;
      process.stdout.write(buf, setCanWriteFlagAndWriteMessageIfNecessary);
    }
  }
  const noopWatcher: FileWatcher = {close: noop};
  function watchDirectorySwallowingException(): FileWatcher {
    return noopWatcher;
  }
  interface WatchedFile {
    readonly fileName: string;
    readonly callback: ts.FileWatcherCallback;
    mtime: Date;
  }
  enum FileWatcherEventKind {
    Created,
    Changed,
    Deleted,
  }
  function getFileWatcherEventKind(oldTime: number, newTime: number) {
    return oldTime === 0
      ? FileWatcherEventKind.Created
      : newTime === 0
      ? FileWatcherEventKind.Deleted
      : FileWatcherEventKind.Changed;
  }
  function onWatchedFileStat(
    watchedFile: WatchedFile,
    modifiedTime: Date,
  ): boolean {
    const oldTime = watchedFile.mtime.getTime();
    const newTime = modifiedTime.getTime();
    if (oldTime !== newTime) {
      watchedFile.mtime = modifiedTime;
      watchedFile.callback(
        watchedFile.fileName,
        getFileWatcherEventKind(oldTime, newTime),
      );
      return true;
    }

    return false;
  }

  /** Remove the *first* occurrence of `item` from the array. */
  function unorderedRemoveItem<T>(array: T[], item: T) {
    return unorderedRemoveFirstItemWhere(array, element => element === item);
  }
  /** Remove the *first* element satisfying `predicate`. */
  function unorderedRemoveFirstItemWhere<T>(
    array: T[],
    predicate: (element: T) => boolean,
  ) {
    for (let i = 0; i < array.length; i++) {
      if (predicate(array[i])) {
        unorderedRemoveItemAt(array, i);
        return true;
      }
    }
    return false;
  }
  function unorderedRemoveItemAt<T>(array: T[], index: number): void {
    // Fill in the "hole" left at `index`.
    array[index] = array[array.length - 1];
    array.pop();
  }

  const missingFileModifiedTime = new Date(0);

  type FileWatcherCallback = (
    fileName: string,
    eventKind: FileWatcherEventKind,
  ) => void;
  function createPollingWatchedFileSet(interval = 2500, chunkSize = 30) {
    const watchedFiles: WatchedFile[] = [];
    let nextFileToCheck = 0;
    return {getModifiedTime, poll, startWatchTimer, addFile, removeFile};

    function getModifiedTime(fileName: string): Date {
      return FS.statSync(fileName).mtime;
    }

    function poll(checkedIndex: number) {
      const watchedFile = watchedFiles[checkedIndex];
      if (!watchedFile) {
        return;
      }

      FS.stat(watchedFile.fileName, (err, stats) => {
        if (err) {
          if (err.code === 'ENOENT') {
            if (watchedFile.mtime.getTime() !== 0) {
              watchedFile.mtime = missingFileModifiedTime;
              watchedFile.callback(
                watchedFile.fileName,
                FileWatcherEventKind.Deleted,
              );
            }
          } else {
            watchedFile.callback(
              watchedFile.fileName,
              FileWatcherEventKind.Changed,
            );
          }
        } else {
          onWatchedFileStat(watchedFile, stats.mtime);
        }
      });
    }

    // this implementation uses polling and
    // stat due to inconsistencies of fs.watch
    // and efficiency of stat on modern filesystems
    function startWatchTimer() {
      // eslint-disable-next-line no-restricted-globals
      setInterval(() => {
        let count = 0;
        let nextToCheck = nextFileToCheck;
        let firstCheck = -1;
        while (count < chunkSize && nextToCheck !== firstCheck) {
          poll(nextToCheck);
          if (firstCheck < 0) {
            firstCheck = nextToCheck;
          }
          nextToCheck++;
          if (nextToCheck === watchedFiles.length) {
            nextToCheck = 0;
          }
          count++;
        }
        nextFileToCheck = nextToCheck;
      }, interval);
    }

    function addFile(
      fileName: string,
      callback: FileWatcherCallback,
    ): WatchedFile {
      const file: WatchedFile = {
        fileName,
        callback,
        mtime: sys.fileExists(fileName)
          ? getModifiedTime(fileName)
          : missingFileModifiedTime, // Any subsequent modification will occur after this time
      };

      watchedFiles.push(file);
      if (watchedFiles.length === 1) {
        startWatchTimer();
      }
      return file;
    }

    function removeFile(file: WatchedFile) {
      unorderedRemoveItem(watchedFiles, file);
    }
  }

  return new server.ProjectService({
    host: sys,
    cancellationToken: server.nullCancellationToken,
    useSingleInferredProject: false,
    useInferredProjectPerProjectRoot: false,
    typingsInstaller: server.nullTypingsInstaller,
    logger: new Logger('', false, server.LogLevel.terse),
  });
}
