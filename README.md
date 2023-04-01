# Cloudflare Whisper

## これは何

- Cloudflare Workers 上に、OpenAI API の Transcribe API と Completion API を使って文字起こしをするアプリケーションを構築するリポジトリ

## どうやって使うの

```shell
echo OPENAI_API_KEY=あなたのOpenAI API Key > .dev.vars
npm install
npm run dev
```

でローカル起動できます。

http://localhost:8787/static にアクセスすると、一通りの機能を利用することができます。
