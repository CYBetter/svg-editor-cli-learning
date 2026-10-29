import { Numeric } from '../../domain/Numeric';
import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class MoveCommand extends Command {
  private readonly id: string;
  private readonly dx: number;
  private readonly dy: number;

  constructor(args: readonly string[]) {
    super();
    MoveCommand.checkArguments(args, 3, 3, 'move <id> <dx> <dy>');
    this.id = args[0];
    this.dx = Numeric.parse(args[1], 'dx');
    this.dy = Numeric.parse(args[2], 'dy');
  }

  override execute(session: EditorSession): string {
    const shape = session.document.find(this.id);
    shape.move(this.dx, this.dy);
    return `moved ${shape.describe()}`;
  }
}
