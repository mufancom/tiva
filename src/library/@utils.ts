import {getTokenAtPosition} from 'tsutils';
import {
  Diagnostic,
  Expression,
  Node,
  flattenDiagnosticMessageText,
  isArrayLiteralExpression,
  isPropertyAssignment,
  isVariableDeclaration,
} from 'typescript/lib/tsserverlibrary';

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

    /* istanbul ignore else */
    if (parentNode) {
      if (isArrayLiteralExpression(parentNode)) {
        let index = parentNode.elements.indexOf(node as Expression);
        path.unshift(`[${index}]`);
      } else if (isPropertyAssignment(parentNode)) {
        path.unshift(`[${parentNode.name.getText()}]`);
      }
    }

    node = parentNode;
  }

  return `Diagnostic value path: ${path.join('') || '(root)'}`;
}

export function indent(text: string, indent: string): string {
  return text.replace(/^(?=[^\r\n])/gm, indent);
}
