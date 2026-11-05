# CLAUDE.md — AI会議室

Expo（React Native + TypeScript）製の iPhone アプリ。Claude / ChatGPT / Gemini / Grok を「メンバー」として1つの会議室に集め、雑談・議論させる。
Expo 全般のルールは [AGENTS.md](AGENTS.md) を読むこと（SDK 58。記憶の API を信じず、`node_modules` の型定義で確認する）。

この開発は **ループエンジニアリングの実験** で、AIエージェントがオーナー（Emmett、プログラミング初心者）への確認を最小限にして自走する。
自走のルールは [docs/loop-rules.md](docs/loop-rules.md)、記録は [docs/experiment-log.md](docs/experiment-log.md)。作業前に両方を読むこと。

## 構成

- `src/core/` 画面に依存しない中身（司会・プロンプト・料金計算・AI呼び出し）。**ロジックはここに置き、必ず Vitest のテストを書く**
- `src/state/` アプリ状態（React Context）と保存（AsyncStorage / APIキーは expo-secure-store）
- `src/app/` 画面（Expo Router。ファイル＝画面）
- `src/ui/` 共通部品とテーマ

## コマンド（作業の最後に全部通すこと）

```bash
npm run typecheck   # 型チェック
npm test            # src/core のユニットテスト
npm run export:web  # Web版を書き出してバンドルが通るか確認
```

画面を変えたら、Web版を Playwright（iPhone 13 エミュレーション）で開いてスクショ確認する。
`expo install` は外部APIに繋がらない環境がある。その場合は `node_modules/expo/bundledNativeModules.json` の版を見て `npm i <pkg>@<版>` で入れる。

## 守ること

- APIキーなどの秘密情報をコード・リポジトリ・ログに書かない
- Web では `<Link asChild>` に配列 style の Pressable を渡すと落ちる。画面遷移は `router.push` を使う
- `ios/` `android/` は手で作らない（Continuous Native Generation）
- UIの文言は日本語。オーナー向けの説明は初心者向けに
