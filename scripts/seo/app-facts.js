// Facts about Texter that the structured data states. Each value must match what the pages show.
// Sources: prices = LP pricing section (iOS PlanComparison* / IAPProduct.swift),
// operator = /tokushoho/, store ids and minimum OS = App Store / Google Play listings.
// No aggregateRating: the LP shows the App Store score (4.1 on 2026-10-05, 7,835 ratings in JP) but not the
// rating count, and a hard-coded count would go stale. Without it the page is not eligible for Google's
// Software App rich result (accepted); the entity data still applies.
module.exports = {
  site: 'https://texter.work',
  org: {
    name: 'Somewhere LLC',
    email: 'texter.work.app@gmail.com',
    address: { addressLocality: 'Kyoto', addressCountry: 'JP' },
  },
  appStoreId: '1482592304',
  playId: 'com.matz.Texter',
  appStore: { ja: 'https://apps.apple.com/jp/app/id1482592304', en: 'https://apps.apple.com/app/id1482592304' },
  googlePlay: 'https://play.google.com/store/apps/details?id=com.matz.Texter',
  operatingSystem: 'iOS 16.0 or later, iPadOS, watchOS, macOS (Apple Silicon), Android',
  // JPY, as listed on the LP pricing section.
  prices: { weekly: 600, monthly: 1800, yearly: 8800 },
  ja: {
    alternateName: ['Texter 議事録・音声文字起こし', 'テキスター'],
    description: '会議や取材を録音すると、文字起こし・話者識別・要約・タスク整理までTexterが自動化。あとから過去の記録に質問して、元の発言まで戻れます。',
    category: 'AI文字起こし・議事録アプリ',
    offers: { free: '無料', weekly: 'Premium 週額', monthly: 'Premium 月額', yearly: 'Premium 年額' },
    // Mirrors the feature headings on the LP.
    features: [
      '録音してそのまま文字起こし', '音声・動画ファイルを取り込む', 'Apple Watch・ウィジェット',
      '高精度な文字起こしと話者識別', '要約と内容まとめ', '99言語の文字起こしと翻訳',
      'すべてのノートに聞く', '根拠つきの回答', '元の発言から再生',
      'タスクを自動抽出', 'ワンタップでリマインダー', '共有・書き出し',
      '画像の文字起こし（OCR）', '動画の字幕生成・PiP', '無音カット', '話題マップ', 'ワードクラウド', '音声入力キーボード',
    ],
  },
  en: {
    alternateName: ['Texter: Audio & Video to Text'],
    description: 'Record a meeting or interview and Texter transcribes it, labels speakers, summarizes, and pulls out the tasks automatically. Later, ask questions across your past notes and jump back to the original words.',
    category: 'AI transcription & meeting notes app',
    offers: { free: 'Free', weekly: 'Premium weekly', monthly: 'Premium monthly', yearly: 'Premium yearly' },
    features: [
      'Record and transcribe live', 'Import audio and video files', 'Apple Watch and widgets',
      'Accurate transcription with speaker labels', 'Summaries and structured notes', '99 languages and translation',
      'Ask all your notes', 'Answers with evidence', 'Play the original words',
      'Tasks, extracted automatically', 'One-tap reminders', 'Share and export',
      'Text from images (OCR)', 'Video captions and PiP', 'Silence removal', 'Topic map', 'Word cloud', 'Voice keyboard',
    ],
  },
};
