declare module 'word-extractor' {
  class WordExtractor {
    extract(buffer: Buffer): Promise<{
      getBody(): string;
      getFootnotes(): string;
      getHeaders(): string;
      getAnnotations(): string;
    }>;
  }
  export default WordExtractor;
}
