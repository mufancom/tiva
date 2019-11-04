import * as Path from 'path';
import * as FS from 'fs';
import * as _ from 'lodash';

import {
  CompilerOptions,
  LanguageServiceHost,
  ScriptSnapshot,
  createDocumentRegistry,
  createLanguageService,
  getDefaultLibFilePath,
  ResolvedProjectReference,
  ResolvedModule,
  resolveModuleName,
  sys,
  parseJsonConfigFileContent,
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
  SyntaxKind,
  isLiteralTypeNode,
} from 'typescript';

interface LanguageServiceInfo {
  version: number;
  entryFileContent: string;
  content: string;
  typeName: string;
  extensions?: {[key: string]: Function} | undefined;
}

function isKeywordTypeNode(node: Node): boolean {
  return (
    node.kind === SyntaxKind.AnyKeyword ||
    node.kind === SyntaxKind.UnknownKeyword ||
    node.kind === SyntaxKind.NumberKeyword ||
    node.kind === SyntaxKind.BigIntKeyword ||
    node.kind === SyntaxKind.ObjectKeyword ||
    node.kind === SyntaxKind.BooleanKeyword ||
    node.kind === SyntaxKind.StringKeyword ||
    node.kind === SyntaxKind.SymbolKeyword ||
    node.kind === SyntaxKind.ThisKeyword ||
    node.kind === SyntaxKind.VoidKeyword ||
    node.kind === SyntaxKind.UndefinedKeyword ||
    node.kind === SyntaxKind.NullKeyword ||
    node.kind === SyntaxKind.NeverKeyword
  );
}

export class LanguageServiceHelper {
  languageService: LanguageService;

  readonly optionsPath: string;

  scriptFileNames: string[] = [];

  scriptFileInfos: LanguageServiceInfo[] = [];

  projectPath: string;

  /** @internal */
  private typeChecker: TypeChecker | undefined;

  constructor(optionsPath: string) {
    this.optionsPath = optionsPath;

    this.projectPath = Path.dirname(optionsPath);

    const {options: compilerOptions} = parseJsonConfigFileContent(
      require(optionsPath),
      {
        useCaseSensitiveFileNames: true,
        readDirectory: sys.readDirectory,
        fileExists: sys.fileExists,
        readFile: sys.readFile,
      },
      this.projectPath,
    );

    const serviceHost: LanguageServiceHost = {
      getScriptFileNames: () => {
        return this.scriptFileNames;
      },
      getScriptVersion: (fileName: string) => {
        for (let i = 0; i < this.scriptFileNames.length; ++i) {
          if (fileName === this.scriptFileNames[i]) {
            return this.scriptFileInfos[i].version.toString();
          }
        }

        return '0';
      },
      getScriptSnapshot: fileName => {
        for (let i = 0; i < this.scriptFileNames.length; ++i) {
          if (fileName === this.scriptFileNames[i]) {
            return ScriptSnapshot.fromString(this.scriptFileInfos[i].content);
          }
        }

        try {
          return ScriptSnapshot.fromString(FS.readFileSync(fileName, 'utf-8'));
        } catch (error) {
          return undefined;
        }
      },
      getCurrentDirectory: () => {
        return this.projectPath;
      },
      getCompilationSettings() {
        return compilerOptions;
      },
      getDefaultLibFileName(options) {
        return getDefaultLibFilePath(options);
      },
      resolveModuleNames: (
        moduleNames: string[],
        containingFile: string,
        _reusedNames: string[] | undefined,
        _redirectedReference: ResolvedProjectReference | undefined,
        options: CompilerOptions,
      ): (ResolvedModule | undefined)[] => {
        const resolvedModules: ResolvedModule[] = [];

        for (const moduleName of moduleNames) {
          let result = resolveModuleName(moduleName, containingFile, options, {
            fileExists: sys.fileExists,
            readFile: sys.readFile,
          });

          if (result.resolvedModule) {
            resolvedModules.push(result.resolvedModule);
          } else {
            if (/\.(css|svg)$/.test(moduleName)) {
              resolvedModules.push({
                resolvedFileName: `${this.projectPath}/tsconfig.json`,
              }); // TODO: push 一个空对象？

              continue;
            }

            let moduleSearchLocations: string[] = [];

            let nodeModulesDirname = this.projectPath;

            while (1) {
              let path = Path.join(
                nodeModulesDirname,
                'node_modules/@types/node',
              );

              if (FS.existsSync(path)) {
                moduleSearchLocations.push(path);

                break;
              }

              let nextNodeModulesDirname = Path.resolve(
                nodeModulesDirname,
                '..',
              );

              if (nodeModulesDirname === nextNodeModulesDirname) {
                break;
              }

              nodeModulesDirname = nextNodeModulesDirname;
            }

            for (const location of moduleSearchLocations) {
              const modulePath = Path.join(location, moduleName + '.d.ts');

              if (sys.fileExists(modulePath)) {
                resolvedModules.push({resolvedFileName: modulePath});
              }
            }
          }
        }
        return resolvedModules;
      },
    };

    this.languageService = createLanguageService(
      serviceHost,
      createDocumentRegistry(),
    );
  }

  add(
    fileName: string,
    typeName: string,
    extensions?: {[key: string]: Function} | undefined,
  ): number {
    this.scriptFileNames.push(this.getUniqueFileName(fileName));

    let content = FS.readFileSync(fileName).toString();

    this.scriptFileInfos.push({
      version: 0,
      entryFileContent: content,
      content: content,
      typeName: typeName,
      extensions: extensions,
    });

    return this.scriptFileNames.length - 1;
  }

  validate(id: number, obj: object) {
    if (id < 0 || id >= this.scriptFileNames.length) {
      return;
    }

    let json = JSON.stringify(obj);

    this.scriptFileInfos[
      id
    ].content = `${this.scriptFileInfos[id].entryFileContent}\nexport const ____aaaa: ${this.scriptFileInfos[id].typeName} = ${json};`;

    ++this.scriptFileInfos[id].version;

    let fileName = this.scriptFileNames[id];

    let diagnostics = [
      ...this.languageService.getSyntacticDiagnostics(fileName),
      ...this.languageService.getSemanticDiagnostics(fileName),
    ];

    if (diagnostics.length) {
      throw new Error(
        `errors detected: ${json}\n${diagnostics.map(diagnostic =>
          flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        )}\n`,
      );
    } else {
      let program = this.languageService.getProgram()!;
      let sourceFile = program.getSourceFile(this.scriptFileNames[id]);

      if (!sourceFile) {
        throw new Error('sourceFile is undefined');
      }

      this.typeChecker = program.getTypeChecker();

      let scriptFileInfo = this.scriptFileInfos[id];

      if (
        scriptFileInfo.extensions &&
        typeof scriptFileInfo.extensions === 'object'
      ) {
        let node = sourceFile.statements[
          sourceFile.statements.length - 1
        ] as VariableStatement;
        let declaration = node.declarationList.declarations[0];

        if (
          !this.extensionsValidate(
            declaration.type!,
            declaration.initializer,
            scriptFileInfo.extensions,
          )
        ) {
          throw new Error(
            `extension validate failed:\ntype: ${declaration.type!.getText()}\ninitializer: ${declaration.initializer!.getText()}\n`,
          );
        }
      }
    }
  }

  /** @internal */
  private extensionsValidate = (
    type: Node | undefined,
    node: Node | undefined,
    extensions: {[key: string]: Function},
  ): boolean => {
    if (type === undefined || node === undefined) {
      return true;
    }

    if (isTypeReferenceNode(type)) {
      let symbol = this.typeChecker!.getSymbolAtLocation(type.typeName);

      if (symbol) {
        return this.extensionsValidate(
          symbol.declarations[0],
          node,
          extensions,
        );
      } else {
        throw new Error('symbol is undefined');
      }
    } else if (isTypeAliasDeclaration(type)) {
      return this.extensionsValidate(type.type, node, extensions);
    } else if (isUnionTypeNode(type)) {
      for (let typeNode of type.types) {
        if (this.extensionsValidate(typeNode, node, extensions)) {
          return true;
        }
      }

      return false;
    } else if (isIntersectionTypeNode(type)) {
      let result = true;

      for (let childType of type.types) {
        result = result && this.extensionsValidate(childType, node, extensions);
      }

      return result;
    } else if (
      (isInterfaceDeclaration(type) ||
        isTypeLiteralNode(type) ||
        isClassDeclaration(type)) &&
      isObjectLiteralExpression(node)
    ) {
      let result = true;

      for (let i = 0; i < type.members.length; ++i) {
        for (let j = 0; j < node.properties.length; ++j) {
          let typePropertyName = type.members[i].name;
          let nodePropertyName = node.properties[j].name;

          if (typePropertyName && nodePropertyName) {
            if (
              typePropertyName.getText() ===
              nodePropertyName.getText().replace(/"/g, '')
            ) {
              result =
                result &&
                this.extensionsValidate(
                  type.members[i],
                  node.properties[j],
                  extensions,
                );
            }
          }
        }
      }

      return result;
    } else if (
      (isPropertySignature(type) || isPropertyDeclaration(type)) &&
      isPropertyAssignment(node)
    ) {
      let references = this.languageService.getReferencesAtPosition(
        type.getSourceFile().fileName,
        type.name.getStart(),
      );

      if (!references) {
        return false;
      }

      let isMatch = false;
      let nodeStartPosition = node.getStart() + 1;

      for (let reference of references) {
        if (reference.textSpan.start === nodeStartPosition) {
          isMatch = true;
          break;
        }
      }

      if (!isMatch) {
        return false;
      }

      let result = true;
      let tags = getJSDocTags(type);

      if (tags) {
        for (let tag of tags) {
          let validateFunction = extensions[tag.tagName.getText()];

          if (validateFunction) {
            result =
              result &&
              validateFunction(
                JSON.parse(node.initializer.getText()),
                tag.comment,
              );
          }
        }
      }

      if (type.type) {
        result =
          result &&
          this.extensionsValidate(type.type, node.initializer, extensions);
      }

      return result;
    } else if (isArrayTypeNode(type) && isArrayLiteralExpression(node)) {
      let result = true;

      for (let element of node.elements) {
        result =
          result &&
          this.extensionsValidate(type.elementType, element, extensions);
      }

      return result;
    }

    return isKeywordTypeNode(type) || isLiteralTypeNode(type);
  };

  /** @internal */
  private getUniqueFileName(fileName: string): string {
    let uniqueFileName: string = this.generateRandomFileName(fileName);

    while (!this.isUnique(uniqueFileName)) {
      uniqueFileName = this.generateRandomFileName(fileName);
    }

    return uniqueFileName;
  }

  /** @internal */
  private isUnique(checkingfileName: string): boolean {
    for (let fileName of this.scriptFileNames) {
      if (checkingfileName === fileName) {
        return false;
      }
    }

    return true;
  }

  /** @internal */
  private generateRandomFileName(fileName: string): string {
    return Path.join(
      Path.dirname(fileName),
      `${Math.random()
        .toString(36)
        .substring(2)}${Path.extname(fileName)}`,
    );
  }
}
