import * as Path from 'path';

import {getTokenAtPosition} from 'tsutils';
import {Dict} from 'tslang';
import {
  getJSDocTags,
  isArrayTypeNode,
  isClassDeclaration,
  isConditionalTypeNode,
  isInterfaceDeclaration,
  isIntersectionTypeNode,
  isMappedTypeNode,
  isPropertyAssignment,
  isPropertyDeclaration,
  isPropertySignature,
  isTupleTypeNode,
  isTypeAliasDeclaration,
  isTypeLiteralNode,
  isTypeReferenceNode,
  isUnionTypeNode,
  JSDocTag,
  LanguageService,
  Node,
  Program,
  PropertyAssignment,
  ScriptKind,
  server,
  SourceFile,
  VariableStatement,
} from 'typescript/lib/tsserverlibrary';

import {logger, serverHost, getDeepestMessageText} from '../@typescript';

import {builtInExtensions} from './@built-in-extensions';

export type GeneralValidatorTypeOptions = string | ValidatorTypeOptions;

export interface ValidatorTypeOptions {
  module: string;
  type: string;
}

/**
 * @returns A string that describes the mismatch or `undefined` for valid
 * value.
 */
export type ValidatorExtension<TContext extends object = object> = (
  value: unknown,
  comment: string | undefined,
  context: TContext,
  tagUniqueId: string,
) => string | undefined;

export type ValidatorExtensions<TContext extends object = object> = Dict<
  ValidatorExtension<TContext>
>;

export interface ValidatorOptions {
  project?: string;
  extensions?: ValidatorExtensions;
  compilerOptions?: server.protocol.ExternalProjectCompilerOptions;
}

export class Validator {
  private projectPath = this.options.project
    ? Path.resolve(this.options.project)
    : process.cwd();

  private validatorFilePath = server.toNormalizedPath(
    Path.join(this.projectPath, '__tiva.ts'),
  );

  private extensionMap = new Map(
    Object.entries({
      ...builtInExtensions,
      ...this.options.extensions,
    }),
  );

  private projectService: server.ProjectService;

  private scriptInfo: server.ScriptInfo;

  private project: server.Project;

  private languageService: LanguageService;

  private program!: Program;

  private sourceFile!: SourceFile;

  private visitedNodeSet!: Set<Node>;

  private extensionReasons!: string[];

  private context!: object;

  constructor(private options: ValidatorOptions) {
    this.projectService = new server.ProjectService({
      host: serverHost,
      cancellationToken: server.nullCancellationToken,
      useSingleInferredProject: false,
      useInferredProjectPerProjectRoot: true,
      typingsInstaller: server.nullTypingsInstaller,
      logger,
    });

    this.projectService.setCompilerOptionsForInferredProjects(
      options.compilerOptions || {
        strict: true,
      },
    );

    this.projectService.openClientFile(
      this.validatorFilePath,
      '',
      ScriptKind.TS,
      this.projectPath,
    );

    let scriptInfo = this.projectService.getScriptInfo(this.validatorFilePath);

    if (!scriptInfo) {
      throw new Error('Expecting script info present');
    }

    this.scriptInfo = scriptInfo;

    this.project = scriptInfo.getDefaultProject();

    this.languageService = this.project.getLanguageService(true);
  }

  diagnose(
    type: GeneralValidatorTypeOptions,
    value: unknown,
  ): string[] | undefined {
    let moduleSpecifier: string | undefined;

    if (typeof type !== 'string') {
      moduleSpecifier = type.module;
      type = type.type;
    }

    let scriptContent = [
      moduleSpecifier &&
        `import {${type.match(/^[^.]+/)![0]}} from ${JSON.stringify(
          moduleSpecifier,
        )};`,
      `export const __tiva: ${type} = ${JSON.stringify(value)};`,
    ]
      .filter((part): part is string => !!part)
      .join('\n');

    let scriptInfo = this.scriptInfo;

    scriptInfo.editContent(
      0,
      scriptInfo.getSnapshot().getLength(),
      scriptContent,
    );

    this.languageService = this.project.getLanguageService(true);

    let languageService = this.languageService;

    let reasons = languageService
      .getSemanticDiagnostics(scriptInfo.fileName)
      .map(message => getDeepestMessageText(message.messageText));

    if (reasons.length) {
      return reasons;
    }

    this.extensionReasons = [];

    this.program = languageService.getProgram()!;

    this.sourceFile = this.program.getSourceFile(scriptInfo.fileName)!;

    this.visitedNodeSet = new Set();

    this.context = {};

    let sourceFile = this.sourceFile;

    let node = sourceFile.statements[
      sourceFile.statements.length - 1
    ] as VariableStatement;

    let declaration = node.declarationList.declarations[0];

    this.validateWithExtensions(declaration.type);

    if (this.extensionReasons.length) {
      return this.extensionReasons;
    }

    return undefined;
  }

  private validateWithExtensions(node: Node | undefined): void {
    if (!node || this.visitedNodeSet.has(node)) {
      return;
    }

    this.visitedNodeSet.add(node);

    if (isPropertySignature(node) || isPropertyDeclaration(node)) {
      let extensionMap = this.extensionMap;

      let tags = getJSDocTags(node);

      let tagExtensionPairs = tags
        .map(tag => [tag, extensionMap.get(tag.tagName.getText())])
        .filter((pair): pair is [JSDocTag, ValidatorExtension] => !!pair[1]);

      if (tagExtensionPairs.length) {
        let extensionReasons = this.extensionReasons;

        let values = this.findValuesByDefinition(node);

        for (let value of values) {
          for (let [tag, extension] of tagExtensionPairs) {
            let comment = tag.comment;
            let tagUniqueId = `${
              tag.getSourceFile().fileName
            }:${tag.getStart()}`;

            let reason = extension(value, comment, this.context, tagUniqueId);

            if (typeof reason === 'string') {
              extensionReasons.push(reason);
            }
          }
        }
      }

      this.validateWithExtensions(node.type);
    } else if (
      isInterfaceDeclaration(node) ||
      isTypeLiteralNode(node) ||
      isClassDeclaration(node)
    ) {
      for (let member of node.members) {
        // TODO: when is member.name undefined?
        if (member.name) {
          this.validateWithExtensions(member);
        }
      }
    } else if (isTypeReferenceNode(node)) {
      let definitions = this.languageService.getDefinitionAtPosition(
        node.getSourceFile().fileName,
        node.typeName.getEnd(),
      );

      if (definitions) {
        let program = this.program;

        for (let definition of definitions) {
          let token = getTokenAtPosition(
            program.getSourceFile(definition.fileName)!,
            definition.textSpan.start,
          )!;

          this.validateWithExtensions(token.parent);
        }
      }

      if (node.typeArguments) {
        for (let typeArgument of node.typeArguments) {
          this.validateWithExtensions(typeArgument);
        }
      }
    } else if (isTypeAliasDeclaration(node)) {
      this.validateWithExtensions(node.type);
    } else if (isUnionTypeNode(node) || isIntersectionTypeNode(node)) {
      for (let childType of node.types) {
        this.validateWithExtensions(childType);
      }
    } else if (isArrayTypeNode(node)) {
      this.validateWithExtensions(node.elementType);
    } else if (isTupleTypeNode(node)) {
      for (let childType of node.elementTypes) {
        this.validateWithExtensions(childType);
      }
    } else if (isConditionalTypeNode(node)) {
      this.validateWithExtensions(node.trueType);
      this.validateWithExtensions(node.falseType);
    } else if (isMappedTypeNode(node)) {
      this.validateWithExtensions(node.type);
      this.validateWithExtensions(node.typeParameter);
    }
  }

  private findValuesByDefinition(
    node: ts.PropertySignature | ts.PropertyDeclaration,
  ): unknown[] {
    let references =
      this.languageService.getImplementationAtPosition(
        node.getSourceFile().fileName,
        node.name.getStart(),
      ) || [];

    let validatorFilePath = this.validatorFilePath;

    return references
      .map(reference => {
        if (reference.fileName !== validatorFilePath) {
          return undefined;
        }

        let parent = getTokenAtPosition(
          this.sourceFile,
          reference.textSpan.start,
        )!.parent;

        return parent && isPropertyAssignment(parent) ? parent : undefined;
      })
      .filter((assignment): assignment is PropertyAssignment => !!assignment)
      .map(assignment => JSON.parse(assignment.initializer.getText()));
  }
}
