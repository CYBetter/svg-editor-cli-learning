import { ShapeFactory } from '../../domain/ShapeFactory';
import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class CreateCommand extends Command {
  private readonly type: string;
  private readonly id: string;
  private readonly params: readonly string[];

  constructor(args: readonly string[]) {
    super();
    CreateCommand.checkArguments(args, 2, Number.MAX_SAFE_INTEGER, 'create <type> <id> [params...]');
    [this.type, this.id] = args;
    this.params = args.slice(2);
  }

  override execute(session: EditorSession): string {
    const document = session.document;
    const shape = new ShapeFactory().create(this.type, this.id, this.params);
    document.add(shape);
    return `${shape.label} created`;
  }
}
