import {DiagnosticMessageChain} from 'typescript/lib/tsserverlibrary';

export function getDeepestMessageText(
  message: DiagnosticMessageChain | string,
): string {
  if (typeof message === 'string') {
    return message;
  }

  if (message.next) {
    return getDeepestMessageText(message.next[0]);
  }

  return message.messageText;
}
