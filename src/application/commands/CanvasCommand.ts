import { Numeric } from '../../domain/Numeric';
import { EditorSession } from '../EditorSession';
import { Command } from './Command';

export class CanvasCommand extends Command {
  private readonly width?: number;
  private readonly height?: number;

  constructor(args: readonly string[]) {
    super();
    CanvasCommand.checkArguments(args, 0, 2, 'canvas [w] [h]');
    if (args[0] !== undefined) this.width = Numeric.parse(args[0], 'canvas width');
    if (args[1] !== undefined) this.height = Numeric.parse(args[1], 'canvas height');
  }

  override execute(session: EditorSession): string {
    if (this.width === undefined) return `canvas ${session.document.size}`;
    return `canvas ${session.resizeCanvas(this.width, this.height).size} updated`;
  }
}
