declare module 'kuromoji' {
  export interface IpadicFeatures {
    surface_form: string
    reading?: string
    pronunciation?: string
    word_type?: string
  }

  export interface Tokenizer<T = IpadicFeatures> {
    tokenize(text: string): T[]
  }

  export interface BuilderOption {
    dicPath: string
  }

  export function builder(option: BuilderOption): {
    build(callback: (err: Error | null, tokenizer: Tokenizer<IpadicFeatures>) => void): void
  }
}
