import { ShapeFactory } from '../../domain/ShapeFactory';
import { CommandToken } from '../CommandToken';
import { SvgDocument } from '../../domain/SvgDocument';
import { EditCommand } from './EditCommand';

export class CreateCommand extends EditCommand {
  private readonly type: string;
  private readonly id: string;
  private readonly params: readonly string[];
  private readonly containerId?: string;

  constructor(args: readonly string[], tokens?: readonly CommandToken[]) {
    super();
    CreateCommand.checkArguments(args, 2, Number.MAX_SAFE_INTEGER, 'create <type> <id> [params...]');
    [this.type, this.id] = args;
    const suffixIndex = args.length - 2;
    if (suffixIndex >= 2 && args[suffixIndex] === 'in' && !tokens?.[suffixIndex]?.quoted) {
      this.containerId = args[suffixIndex + 1];
      this.params = args.slice(2, suffixIndex);
    } else {
      this.params = args.slice(2);
    }
  }

  protected override apply(document: SvgDocument): string {
    const shape = new ShapeFactory().create(this.type, this.id, this.params);
    document.add(shape, this.containerId);
    const parent = this.containerId === undefined ? '' : ` in ${document.find(this.containerId).label}`;
    return `${shape.label} created${parent}`;
  }
}
