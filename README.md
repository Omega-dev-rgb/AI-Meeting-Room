# AI会議室（AI-Meeting-Room）

Claude・ChatGPT・Gemini・Grok を「メンバー」として1つの会議室に集め、雑談や議論をさせる iPhone アプリ（Expo製）。

- 話題を投げると、メンバーが順番に発言する（周回数に上限あり）
- `@名前` で1人だけ指名できる
- 「📝 今どうなってる？」で、論点・決まったこと・次の一手を要約
- 今月の利用料メーター。予算の8割で警告、10割で自動停止
- APIキーなしで試せる「モック」モード

## メンバー（初期設定・変更可）

| 名前 | 中身 | キャラ |
| --- | --- | --- |
| ジーピー | ChatGPT | まとめ役。みんなに寄り添う |
| クロ | Claude | 優しくて慎重。細かいところによく気付く |
| ジェミ | Gemini | よくはしゃぐ。アイデアを否定しない |
| グロック | Grok | 正直で少し皮肉。答えを濁さない |

## 開発

```bash
npm install
npm start           # Expo Go で開く
npm run typecheck && npm test && npm run export:web
```

この開発はAIエージェントが自走する「ループエンジニアリング」の実験です。ルールは [docs/loop-rules.md](docs/loop-rules.md)、記録は [docs/experiment-log.md](docs/experiment-log.md)。
