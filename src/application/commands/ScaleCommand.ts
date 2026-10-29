import { Numeric } from '../../domain/Numeric';
import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class ScaleCommand extends Command {
  private readonly id: string;
  private readonly factor: number;

  constructor(args: readonly string[]) {
    super();
    ScaleCommand.checkArguments(args, 2, 2, 'scale <id> <factor>');
    this.id = args[0];
    this.factor = Numeric.parse(args[1], 'scale factor');
  }

  override execute(session: EditorSession): string {
    const shape = session.document.find(this.id);
    shape.scale(this.factor);
    return `${shape.label} scaled by ${this.factor}`;
  }
}
