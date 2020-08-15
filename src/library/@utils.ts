import {
  Diagnostic,
  isVariableDeclaration,
  isArrayLiteralExpression,
  Expression,
  isPropertyAssignment,
  flattenDiagnosticMessageText,
  Node,
} from 'typescript/lib/tsserverlibrary';
import {getTokenAtPosition} from 'tsutils';

export function formatDiagnostic(diagnostic: Diagnostic): string {
  let file = diagnostic.file!;

  let node = getTokenAtPosition(file, diagnostic.start!);

  return [
    getValuePathMessage(node),
    indent(flattenDiagnosticMessageText(diagnostic.messageText, '\n'), '  '),
  ].join('\n');
}

export function getValuePathMessage(node: Node | undefined): string {
  let path: string[] = [];

  while (node && !isVariableDeclaration(node)) {
    let parentNode = node.parent;

    if (isArrayLiteralExpression(parentNode)) {
      let index = parentNode.elements.indexOf(node as Expression);
      path.unshift(`[${index}]`);
    } else if (isPropertyAssignment(parentNode)) {
      path.unshift(`[${parentNode.name.getText()}]`);
    }

    node = parentNode;
  }

  return ['Diagnostic value path: ', ...path].join('');
}

export function indent(text: string, indent: string): string {
  return text.replace(/^(?=[^\r\n])/gm, indent);
}
