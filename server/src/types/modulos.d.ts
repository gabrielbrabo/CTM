// Tipos simples para bibliotecas sem tipagem propria

declare module "word-extractor" {
  class WordExtractor {
    extract(fonte: Buffer | string): Promise<{ getBody(): string }>;
  }
  export default WordExtractor;
}
