import { Numeric } from '../../domain/Numeric';
import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class InitCommand extends Command {
  private readonly width: number;
  private readonly height: number;

  constructor(args: readonly string[]) {
    super();
    InitCommand.checkArguments(args, 0, 2, 'init [w] [h]');
    this.width = Numeric.parse(args[0] ?? '800', 'canvas width');
    this.height = Numeric.parse(args[1] ?? '600', 'canvas height');
  }

  override execute(session: EditorSession): string {
    return `canvas ${session.initialize(this.width, this.height).size} created`;
  }
}
