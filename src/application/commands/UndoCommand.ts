import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class UndoCommand extends Command {
  constructor(args: readonly string[]) {
    super();
    UndoCommand.checkArguments(args, 0, 0, 'undo');
  }

  override execute(session: EditorSession): string { return session.undo(); }
}
