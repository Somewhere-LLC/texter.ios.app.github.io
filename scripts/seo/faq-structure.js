// Section order and answers corrected by the 2026-11-01 review against iOS origin/develop c02947cc7.
// faq-data.js and faq-howto-data.js hold the base answers. An entry here replaces the answer with the same id.
const ORDER = [
  { id: 'start', ja: 'はじめに', en: 'Getting started', items: ['what-is-texter', 'devices', 'tabs', 'first-setup', 'quick-start'] },
  { id: 'voice', ja: '録音とリアルタイム文字起こし', en: 'Recording and live transcription', items: ['realtime', 'voice-accuracy', 'voice-format', 'pip', 'keyboard', 'apple-watch', 'offline'] },
  { id: 'files', ja: 'ファイルの文字起こし', en: 'Transcribing files', items: ['import', 'import-service', 'wrong-language', 'cloud-link', 'silence-cut', 'import-limit'] },
  { id: 'speakers', ja: '話者識別・言語・翻訳', en: 'Speakers, languages, and translation', items: ['speaker-diarization', 'languages', 'translate-how'] },
  { id: 'image', ja: '画像とPDF', en: 'Images and PDFs', items: ['ocr-how', 'ocr-accuracy'] },
  { id: 'ai', ja: '要約・タスク・AIチャット', en: 'Summaries, tasks, and AI chat', items: ['summary', 'action-items', 'ask-notes', 'topic-map', 'ai-title'] },
  { id: 'manage', ja: 'ノートの管理と共有', en: 'Managing and sharing notes', items: ['folders', 'export', 'slack', 'reminder', 'display', 'subtitle-off'] },
  { id: 'premium', ja: '料金・Premium・支払い', en: 'Pricing, Premium, and billing', items: ['price', 'free-limits', 'premium-what', 'platform-diff', 'charge', 'restore', 'billing', 'cancel', 'business'] },
  { id: 'privacy', ja: 'プライバシー・データの扱い', en: 'Privacy and your data', items: ['storage', 'data-sent', 'ai-training'] },
  { id: 'support', ja: '困ったとき', en: 'Troubleshooting and contact', items: ['not-suited', 'voice-permission', 'contact'] },
];

const OVERRIDES = {
  ja: {
    'platform-diff': { q: 'iPhoneとAndroidで使える機能は違いますか？',
      a: '<p>違いがあります。音声入力キーボード、Apple Watchでの録音、追加チャージはiPhone版の機能です。文字起こしチケットは両方で使えます。Whisperの無料枠も別です。詳しくは<a href="/pricing/#android">料金と利用条件</a>をご覧ください。</p>' },
    'not-suited': { q: 'Texterが向いていないのはどんな使い方ですか？',
      a: '<p>通信なしで話者識別まで使いたい場合や、無料のまま長時間をリアルタイムで記録したい場合には向いていません。ノートを複数の端末で同期する機能もありません。一覧は<a href="/pricing/#not-suited">料金と利用条件</a>をご覧ください。</p>' },
    realtime: { q: '会議をその場で文字起こしするにはどうしますか？',
      a: '<p>「ボイス」タブでマイクをタップして話し、終わったら停止してください。言語と設定に応じて、会話向けのクラウド音声認識エンジンか、Appleの音声認識を使います。自動で保存したいときは、「設定」→「音声入力と文字起こし」→「リアルタイム結果の自動保存」をオンにしてください。無料版の上限は1回3分、1日15分です。</p>' },
    'voice-format': { q: '句読点や段落を自動で整えられますか？',
      a: '<p>「設定」の「AI文字起こし整形」をオンにすると、録音の完了後に句読点や段落を整えます。この項目が表示されない場合があります。</p>' },
    'apple-watch': { q: 'Apple Watchで録音できますか？',
      a: '<p>できます。iPhoneを持っていなくても、Apple Watch単体で録音できます。録音はあとでiPhoneへ転送され、文字起こしされます。1回に録音できる長さは、無料版で最大15分、Premiumで最大2時間です。録音できても、無料版の文字起こしの枠を超えると処理は止まります。</p>' },
    import: { q: '録音済みの音声や動画のファイルも文字起こしできますか？',
      a: '<p>できます。「設定」→「ファイルをインポート」で「音声ファイルをインポート」か「動画をインポート」を選んでください。動画では「動画として保存」か「音声のみ抽出」を選びます。対応しているファイル形式は次のとおりです。</p><ul><li>音声：m4a、mp3、wav、aac、aiff、cafなど</li><li>動画：mp4、mov、m4v</li></ul>' },
    'import-limit': { q: '取り込みでエラーが出ます。上限に達したときはどうしますか？',
      a: '<p>ファイルの上限を超えている可能性があります。Premiumの1ファイルの上限は、Whisperが1GB・2時間、Amazon Transcribeが2GB・4時間です。Amazon Transcribeには、プランごとの月間の利用枠もあります。無料版のWhisperには、処理時間の累積枠があります。ファイルを分割するか、軽い形式に変換してお試しください。無料版の枠を超えると、取り込みの上限画面にPremiumや文字起こしチケットの案内が出ます。チケットはWhisperの文字起こし専用で、2時間までの音声に使えます。</p>' },
    'speaker-diarization': { q: '話者識別（誰が話したかの区別）はできますか？',
      a: '<p>Premiumでご利用いただけます。音声・動画ファイルをWhisperまたはAmazon Transcribeで文字起こしするときに、話者ごとに発言を分けて記録します。Whisperでは話者数を自動か人数で指定でき、Amazon Transcribeは最大10人まで区別します。リアルタイム文字起こしでも「話者識別（ベータ）」を使えます。</p>' },
    languages: { q: '何語に対応していますか？',
      a: '<p>ファイルの文字起こし（Whisper）は、99言語と言語の自動判定に対応しています。リアルタイム文字起こしの対応言語は、使う音声認識エンジンによって異なります。</p>' },
    'translate-how': { q: '話した内容を翻訳できますか？',
      a: '<p>できます。方法は2つあります。</p><ul><li>翻訳画面：「ボイス」タブの右上にある翻訳アイコンをタップします。翻訳サービスはDeepL、Googleオンライン、Googleオフラインから選べ、「設定」→「音声入力と文字起こし」→「翻訳」で変更できます</li><li>リアルタイム翻訳：録音中にマイクの右に出る翻訳のボタンをオンにすると、文字起こしと同時に訳文が出ます。翻訳先は録音画面で選びます。Appleの翻訳機能を使うので、iOS 18以降が必要です</li></ul>' },
    summary: { q: '議事録や要約を自動で作れますか？',
      a: '<p>作れます。議事録、インタビュー、講義、構造化要約など20種類のテンプレートを用意しています。録音のあとに自動で要約するには、「設定」→「テキストと表示」→「要約 / 変換」の「自動要約」で設定してください。</p>' },
    'ask-notes': { q: '保存した記録にあとから質問できますか？',
      a: '<p>できます。ノートの右下にあるチャットのアイコンをタップすると、そのノートについて「決まった納期は？」のように質問できます。ノート一覧の「記録から思い出す」では、複数のノートをまたいで質問できます。無料版は1日3回まで、Premiumでは回数の制限なく使えます。</p>' },
    'ai-title': { q: 'タイトルを自動で付けられますか？',
      a: '<p>iOS 26以降の対応端末で、端末内のAIモデルが使える場合に、録音のあとでタイトルが自動で入ります。</p>' },
    export: { q: 'ノートを共有したり書き出したりするにはどうしますか？',
      a: '<p>ノートの右上のメニューにある「エクスポート」から選んでください。</p><ul><li>ノート：テキスト、PDF、SRT字幕ファイル、字幕付き動画</li><li>内容まとめ：Markdown、テキスト、HTML、PDF</li></ul><p>SRTは、字幕のデータがあるノートだけで選べます。「公開リンクを作成」を選ぶと、ノートをURLで共有できます。</p>' },
    charge: { q: '追加で利用時間を購入できますか？',
      a: '<p>「追加チャージ」で購入できます。無料版の方には、取り込みの上限画面でWhisper用の文字起こしチケット（音声1時間ぶん、<a href="/pricing/">料金</a>）を案内する場合があります。チケットは自動更新されず、残りは失効しません。リアルタイム録音、要約、AIチャット、翻訳には使えません。</p>' },
    storage: { q: '録音やノートはどこに保存されますか？',
      a: '<p>録音とノートは、お使いの端末内に保存されます。Texterのサーバーにノートを保管する同期機能はありません。アプリを削除するとノートも消えるので、機種変更やアプリの削除の前に、必要なノートを書き出してください。</p>' },
    'data-sent': { q: '音声やテキストが外部に送信されることはありますか？',
      a: '<p>クラウドで処理する機能を使うと、処理に必要な音声やテキストを各サービスの提供事業者に送信します。主な対象は、リアルタイム音声認識（Appleの音声認識を含む）、音声入力キーボード、WhisperとAmazon Transcribeによるファイルの文字起こし、翻訳、要約、内容まとめ、タスク抽出、AIチャット、話題マップ、AI文字起こし整形、Slack投稿、公開リンクです。詳しくは<a href="/privacy-policy/">プライバシーポリシー</a>をご確認ください。</p>' },
    'ai-training': { q: '要約やAIチャットに使ったノートは、AIの学習に使われますか？',
      a: '<p>要約、内容まとめ、タスク抽出、AIチャットでは、ノートのテキストをOpenAIのAPIに送信して結果を生成します。OpenAI APIのデータ利用ポリシーにもとづき、送信したデータはOpenAIのモデル学習には使われません。</p>' },
  },
  en: {
    'platform-diff': { q: 'Do iPhone and Android have the same features?',
      a: '<p>No. The voice keyboard, Apple Watch recording, and Add More Usage are on iPhone only. Transcription tickets are available on both. The free Whisper allowance also differs.</p>' },
    'not-suited': { q: 'What is Texter not suited for?',
      a: '<p>It does not suit speaker labels without a network connection, or long live transcription on the free plan. It also has no feature that syncs notes across devices.</p>' },
    realtime: { q: 'How do I transcribe a meeting live?',
      a: '<p>On the Voice tab, tap the microphone, speak, then stop. Depending on the language and your settings, Texter uses a cloud speech engine built for conversation or Apple speech recognition. To save automatically, turn on Save Real-Time Transcription Results under Settings → Voice Input &amp; Transcription. The free plan allows 3 minutes per session and 15 minutes a day.</p>' },
    'voice-accuracy': { q: 'How can I improve accuracy?',
      a: '<p>Speak close to the microphone and reduce background noise. Add names and terms in Word Registration (Technical Terms, etc.), with the word and its reading separated by a space. Audio Recording Settings also has a noise reduction option.</p>' },
    'voice-format': { q: 'Can Texter clean up punctuation and paragraphs?',
      a: '<p>Turn on AI Text Formatting in Settings. Texter then adds punctuation and paragraphs after recording. This option may not appear.</p>' },
    'apple-watch': { q: 'Can I record on Apple Watch?',
      a: '<p>Yes. Apple Watch records on its own, without your iPhone nearby. The recording transfers to your iPhone later and is transcribed there. Each recording can be up to 15 minutes on the free plan and up to 2 hours with Premium. Transcription still stops when the free plan allowance runs out.</p>' },
    import: { q: 'Can I transcribe audio or video files I already have?',
      a: '<p>Yes. Open Settings → Import Files, then choose Import Audio or Import Video. For a video, choose whether to keep the video or extract the audio only. Supported formats:</p><ul><li>Audio: m4a, mp3, wav, aac, aiff, caf, and more</li><li>Video: mp4, mov, m4v</li></ul>' },
    'import-limit': { q: 'I get an error when I import a file. What can I do at the limit?',
      a: '<p>The file may be over the limit. With Premium, the per-file limits are 1 GB and 2 hours for Whisper, or 2 GB and 4 hours for Amazon Transcribe. Amazon Transcribe also has a monthly allowance that depends on your plan. Whisper on the free plan has a cumulative allowance based on processing time. Try splitting the file or converting it to a lighter format. When the free allowance runs out, the import limit screen offers Premium or an import ticket. Tickets are for Whisper transcription only and work for audio up to 2 hours.</p>' },
    'wrong-language': { q: 'My audio is transcribed in the wrong language.',
      a: '<p>Go to Settings → Import Files → Choose Your Preferred Speech Recognition Service, set the Whisper Recognition Language, and import again. If the problem continues, contact us and tell us about the audio quality and how you imported it.</p>' },
    'speaker-diarization': { q: 'Can Texter tell speakers apart?',
      a: '<p>Yes, with Premium. When you transcribe an audio or video file with Whisper or Amazon Transcribe, Texter separates the text by speaker. Whisper can detect the number of speakers or use a number you set, and Amazon Transcribe distinguishes up to 10 speakers. Live transcription also offers speaker labels as a beta feature.</p>' },
    languages: { q: 'Which languages are supported?',
      a: '<p>File transcription with Whisper supports 99 languages plus automatic language detection. Languages for live transcription depend on the speech engine in use.</p>' },
    'translate-how': { q: 'Can I translate what I say?',
      a: '<p>Yes, in two ways.</p><ul><li>Translation screen: tap the translate icon at the top right of the Voice tab. Choose DeepL, Google online, or Google offline, and change the service under Settings → Voice Input &amp; Transcription → Translation Settings</li><li>Live Translation: turn on the translate button to the right of the microphone during recording, and translations appear with the transcript. Choose the target language on the recording screen. This uses Apple’s translation feature, so it requires iOS 18 or later</li></ul>' },
    summary: { q: 'Can Texter write meeting minutes and summaries?',
      a: '<p>Yes. There are 20 templates, such as meeting minutes, interview, lecture, and structured summary. To summarize automatically after recording, set Auto Summary under Settings → Text &amp; Display → Summary &amp; Text Conversion Settings.</p>' },
    'ask-notes': { q: 'Can I ask questions about my past recordings?',
      a: '<p>Yes. Tap the chat icon at the bottom right of a note and ask things like “What deadline did we agree on?” The note list also lets you ask across several notes. The free plan allows 3 questions a day, and Premium has no daily limit.</p>' },
    'ai-title': { q: 'Can Texter name notes automatically?',
      a: '<p>Yes. On iOS 26 or later, on devices where the on-device AI model is available, a title is added after recording.</p>' },
    export: { q: 'How do I share or export a note?',
      a: '<p>Open the menu at the top right of a note, then use Export.</p><ul><li>Notes: text, PDF, SRT subtitle file, video with captions</li><li>Structured summaries: Markdown, text, HTML, PDF</li></ul><p>SRT is available only for notes with subtitle data. Create Public Link shares the note with a URL.</p>' },
    charge: { q: 'Can I buy extra usage?',
      a: '<p>You can use Add More Usage. Free users may see a ticket for one hour of Whisper transcription on the import limit screen. Tickets do not renew automatically, and unused time does not expire. They do not cover live recording, summaries, AI chat, or translation.</p>' },
    storage: { q: 'Where are my recordings and notes stored?',
      a: '<p>Recordings and notes are stored on your device. Texter has no sync feature that keeps your notes on our servers. Deleting the app also removes your notes, so export anything you need before you switch phones or delete the app.</p>' },
    'data-sent': { q: 'Is my audio or text ever sent outside the device?',
      a: '<p>When you use a feature that runs in the cloud, Texter sends the audio or text it needs to the service provider. The main features are live transcription (including Apple speech recognition), the voice keyboard, file transcription with Whisper or Amazon Transcribe, translation, summaries, structured summaries, task extraction, AI chat, Topic Overview, AI Text Formatting, Slack posts, and public links. See the <a href="/en/privacy-policy/">Privacy Policy</a> for details.</p>' },
    'ai-training': { q: 'Are notes I use with summaries or AI chat used to train AI models?',
      a: '<p>Summaries, structured summaries, task extraction, and AI chat send the note text to the OpenAI API to generate results. Under the OpenAI API data usage policy, that data is not used to train OpenAI’s models.</p>' },
  },
};

function arrange(lang, sections) {
  const items = {};
  for (const s of sections) for (const q of s.items) items[q.id] = q;
  const overrides = OVERRIDES[lang];
  return ORDER.map((s) => ({
    id: s.id,
    title: s[lang],
    items: s.items.map((id) => {
      const base = items[id];
      const over = overrides[id];
      if (!base && !over) throw new Error(`faq ${lang}: unknown question ${id}`);
      return { id, ...base, ...over };
    }),
  }));
}

module.exports = { arrange };
