import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class SetCommand extends Command {
  private readonly id: string;
  private readonly attribute: string;
  private readonly value: string;

  constructor(args: readonly string[]) {
    super();
    SetCommand.checkArguments(args, 3, 3, 'set <id> <attr> <value>');
    [this.id, this.attribute, this.value] = args;
  }

  override execute(session: EditorSession): string {
    const shape = session.document.find(this.id);
    shape.setAttribute(this.attribute, this.value);
    const value = this.attribute === 'text' ? JSON.stringify(this.value) : this.value;
    return `${shape.label} updated: ${this.attribute}=${value}`;
  }
}
