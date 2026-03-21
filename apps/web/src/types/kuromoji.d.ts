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

declare module 'kuromoji/src/Tokenizer.js' {
  import type { Tokenizer, IpadicFeatures } from 'kuromoji'

  export default class KuromojiTokenizerCtor implements Tokenizer<IpadicFeatures> {
    constructor(dic: unknown)
    tokenize(text: string): IpadicFeatures[]
  }
}

declare module 'kuromoji/src/dict/DynamicDictionaries.js' {
  export default class DynamicDictionaries {
    constructor()
    loadTrie(baseBuffer: Int32Array, checkBuffer: Int32Array): this
    loadTokenInfoDictionaries(
      tokenInfoBuffer: Uint8Array,
      posBuffer: Uint8Array,
      targetMapBuffer: Uint8Array,
    ): this
    loadConnectionCosts(connectionCostsBuffer: Int16Array): this
    loadUnknownDictionaries(
      unkBuffer: Uint8Array,
      unkPosBuffer: Uint8Array,
      unkMapBuffer: Uint8Array,
      catMapBuffer: Uint8Array,
      compatCatMapBuffer: Uint32Array,
      invokeDefBuffer: Uint8Array,
    ): this
  }
}
