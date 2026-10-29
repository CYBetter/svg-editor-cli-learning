import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class AddToCommand extends Command {
  private readonly containerId: string;
  private readonly id: string;

  constructor(args: readonly string[]) {
    super();
    AddToCommand.checkArguments(args, 2, 2, 'addto <gid> <id>');
    [this.containerId, this.id] = args;
  }

  override execute(session: EditorSession): string {
    const shape = session.document.addTo(this.containerId, this.id);
    return `${shape.label} moved into ${session.document.find(this.containerId).label}`;
  }
}
