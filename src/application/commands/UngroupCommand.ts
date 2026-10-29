import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class UngroupCommand extends Command {
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    UngroupCommand.checkArguments(args, 1, 1, 'ungroup <gid>');
    this.id = args[0];
  }

  override execute(session: EditorSession): string {
    const group = session.document.ungroup(this.id);
    return `${group.label} ungrouped`;
  }
}
