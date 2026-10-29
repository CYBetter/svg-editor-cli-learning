import { LoadedDocument } from './LoadedDocument';

export abstract class DocumentReader {
  abstract read(filePath: string): LoadedDocument;
}
