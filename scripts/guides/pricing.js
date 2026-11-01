// /pricing/: plans and limits in one place, so a reader or an AI assistant can compare them.
// Sources (checked 2026-11-01): App Store listing for prices, iOS tag v2.11.68 and production Remote Config for limits.
// Prices come from app-facts.js. Do not list a plan until it is on sale.
const facts = require('../seo/app-facts');

const CHECKED = '2026-11-01';
const yen = (n) => `¥${n.toLocaleString('en-US')}`;
const { weekly, monthly, yearly } = facts.prices;
const { ticket, semiannual, tenHours, twentyHours, chargeRealtime, chargeAmazon, chargeTranslate } = facts.jaPlans;

const questions = [
  { id: 'without-subscription', q: 'サブスクなしで使えますか？',
    a: `<p>使えます。無料版に加えて、ファイルの文字起こしだけを単発で買える文字起こしチケット（1時間 ${yen(ticket)}、自動更新なし）があります。チケットはWhisperによるファイルの文字起こし専用です。</p>` },
  { id: 'free-minutes', q: '無料で何分使えますか？',
    a: '<ul><li>リアルタイム文字起こしは、1回3分、1日15分です</li><li>ファイルの文字起こし（Whisper）は、録音の長さではなく処理時間で数えます。目安は音声でおよそ30〜40分で、使った分は累積します</li><li>音声入力キーボードは、1日3分です</li></ul><p>iOS 26以降なら、端末内で処理するSpeechAnalyzerも無料で選べます。この方式では動画広告が表示されます。</p>' },
  { id: 'sixty-minutes', q: '60分の録音を処理するには何を買えばいいですか？',
    a: `<p>費用をかけない方法は2つです。iOS 26以降なら、動画広告を見て端末内のSpeechAnalyzerを使えます。Whisperの無料枠が残っていれば、音声ファイル1件の取り込みも無料です。枠が残っていないときは、ちょうど60分までなら文字起こしチケット1枚（${yen(ticket)}）で足ります。60分を超えて120分までの音声は2枚です。120分を超える音声はチケットでは処理できません。Amazon Transcribeを使うと、3時間までなら月額（${yen(monthly)}）、4時間までなら年額（${yen(yearly)}）か追加チャージで処理できます。4時間を超える音声は分割してください。</p>` },
  { id: 'realtime-vs-file', q: 'リアルタイムとファイルの取り込みで、料金や上限は違いますか？',
    a: '<p>違います。数え方も枠も別々です。リアルタイムは録音した時間を数え、Premiumでも月ごとの枠があります。ファイルの取り込み（Whisper）は、Premiumなら月の枠がありません。チケットはファイルの取り込み専用で、リアルタイムには使えません。</p>' },
];

const plansTable = `<div class="scroll"><table class="compare plans"><caption>iPhone版のプラン（App Store・日本）</caption>
<thead><tr><th scope="col">項目</th><th scope="col">無料</th><th scope="col">チケット</th><th scope="col">月額</th><th scope="col">年額</th><th scope="col">10時間</th><th scope="col">20時間</th></tr></thead><tbody>
<tr><th scope="row">料金</th><td>${yen(0)}</td><td>${yen(ticket)}/1時間</td><td>${yen(monthly)}/月</td><td>${yen(yearly)}/年</td><td>${yen(tenHours)}/月</td><td>${yen(twentyHours)}/月</td></tr>
<tr><th scope="row">自動更新</th><td>なし</td><td>なし</td><td>あり</td><td>あり</td><td>あり</td><td>あり</td></tr>
<tr><th scope="row">ファイルの文字起こし（Whisper）</th><td>処理時間の累積枠</td><td>1枚で音声1時間</td><td>月の枠なし</td><td>月の枠なし</td><td>月の枠なし</td><td>月の枠なし</td></tr>
<tr><th scope="row">Amazon Transcribe</th><td>なし</td><td>なし</td><td>3時間/月</td><td>5時間/月</td><td>10時間/月</td><td>20時間/月</td></tr>
<tr><th scope="row">リアルタイム文字起こし</th><td>1回3分、1日15分</td><td>無料と同じ</td><td>5時間/月</td><td>10時間/月</td><td>10時間/月</td><td>20時間/月</td></tr>
<tr><th scope="row">音声入力キーボード</th><td>1日3分</td><td>無料と同じ</td><td>リアルタイムと共通の枠</td><td>リアルタイムと共通の枠</td><td>リアルタイムと共通の枠</td><td>リアルタイムと共通の枠</td></tr>
<tr><th scope="row">クラウド翻訳</th><td>1入力300字、1日1,000字</td><td>無料と同じ</td><td>1日10万字</td><td>1日10万字</td><td>1日10万字</td><td>1日10万字</td></tr>
<tr><th scope="row">話者識別</th><td>なし</td><td>なし</td><td>あり</td><td>あり</td><td>あり</td><td>あり</td></tr>
<tr><th scope="row">要約</th><td>3回/日</td><td>無料と同じ</td><td>回数の上限なし</td><td>回数の上限なし</td><td>回数の上限なし</td><td>回数の上限なし</td></tr>
<tr><th scope="row">AIチャット</th><td>3回/日</td><td>無料と同じ</td><td>回数の上限なし</td><td>回数の上限なし</td><td>回数の上限なし</td><td>回数の上限なし</td></tr>
<tr><th scope="row">画像の文字起こし</th><td>5回/日</td><td>無料と同じ</td><td>1,000単位/日</td><td>1,000単位/日</td><td>1,000単位/日</td><td>1,000単位/日</td></tr>
<tr><th scope="row">取り込み時の自動無音カット</th><td>なし</td><td>なし</td><td>あり</td><td>あり</td><td>あり</td><td>あり</td></tr>
<tr><th scope="row">手動の無音カット</th><td>動画広告を見て利用</td><td>無料と同じ</td><td>あり</td><td>あり</td><td>あり</td><td>あり</td></tr>
<tr><th scope="row">広告</th><td>あり</td><td>バナーは無料と同じ。チケットの処理に動画広告なし</td><td>なし</td><td>なし</td><td>なし</td><td>なし</td></tr>
</tbody></table></div>
<p class="note">月額には、初めての方向けの3日間の無料トライアルがあります（対象外の場合があります）。終了すると自動で課金が始まります。対応端末は、iPhone、iPad、Apple Watch、Apple Silicon搭載のMacです。</p>
<ul class="note"><li>6ヶ月プラン（${yen(semiannual)}）は、新規にはアプリから選べません。枠は年額と同じです</li><li>週額プラン（${yen(weekly)}）は、解約時の案内でのみ表示されます。リアルタイムは1時間/月、Amazon Transcribeは30分/月です</li><li>話者識別は、設定でオンにしたときに動きます。通信が必要で、Whisper、Amazon Transcribe（最大10人）、リアルタイム（ベータ）で使えます</li><li>画像の文字起こしの1,000単位は、アプリ内部の集計単位です</li></ul>`;

const sections = [
  { id: 'choose', title: '条件別の選び方', html: `<div class="scroll"><table class="compare"><thead><tr><th scope="col">条件</th><th scope="col">候補</th></tr></thead><tbody>
<tr><th scope="row">サブスクなしで、ときどき録音を文字にしたい</th><td>無料版。枠を使い切ったら文字起こしチケット</td></tr>
<tr><th scope="row">iOS 26以降で、費用をかけず、広告は許容できる</th><td>無料版のSpeechAnalyzer</td></tr>
<tr><th scope="row">毎月4時間以上のファイルを処理する</th><td>月額（${yen(monthly)}）。1年続けるなら年額（月あたり約¥733）。1時間ちょうどの音声なら、月3枚（${yen(ticket * 3)}）まではチケットが割安</td></tr>
<tr><th scope="row">リアルタイムの文字起こしを毎月多く使う</th><td>年額か、10時間・20時間プラン</td></tr>
<tr><th scope="row">話者を分けたい</th><td>Premiumの各プラン</td></tr>
<tr><th scope="row">3時間を超える音声を1本で処理したい</th><td>Amazon Transcribe（1本4時間まで）。10時間（${yen(tenHours)}/月）、20時間、年額、月額＋追加チャージ</td></tr>
</tbody></table></div>` },
  { id: 'plans', title: 'プランの比較', html: plansTable },
  { id: 'counting', title: '時間の数え方', html: `<div class="scroll"><table class="compare"><thead><tr><th scope="col">機能</th><th scope="col">数えるもの</th><th scope="col">枠が戻る時期</th></tr></thead><tbody>
<tr><th scope="row">Whisper（無料）</th><td>サーバーの処理時間</td><td>累積するので、月ごとには戻りません</td></tr>
<tr><th scope="row">Whisper（チケット）</th><td>音声の長さ（秒単位で切り上げ）</td><td>残りは失効しません</td></tr>
<tr><th scope="row">リアルタイム（無料）</th><td>録音した時間</td><td>毎日</td></tr>
<tr><th scope="row">リアルタイム（Premium）</th><td>音声の長さ</td><td>毎月</td></tr>
<tr><th scope="row">Amazon Transcribe</th><td>音声の長さ</td><td>毎月</td></tr>
</tbody></table></div><p class="note">Whisperの処理時間は、これまでの実績では音声の長さの約2〜3割です。音声によって変わるので、録音時間に換算した数字は目安として読んでください。</p>` },
  { id: 'file-limits', title: '1ファイルの上限', html: `<div class="scroll"><table class="compare"><thead><tr><th scope="col">方式</th><th scope="col">無料</th><th scope="col">チケット</th><th scope="col">Premium</th></tr></thead><tbody>
<tr><th scope="row">Whisper</th><td>1GB。枠が残っていれば音声1件は処理できます</td><td>1GB、2時間</td><td>1GB、2時間</td></tr>
<tr><th scope="row">Amazon Transcribe</th><td>なし</td><td>なし</td><td>2GB、4時間</td></tr>
</tbody></table></div><p class="note">写真ライブラリから選ぶ動画と、複数ファイルの同時取り込みには別の長さの判定があります。無料版とチケットで写真ライブラリから選ぶ動画は、8分20秒までです。長い動画は「ファイルをインポート」から選んでください。</p>` },
  { id: 'unlimited', title: '「無制限」の意味', html: `<p>Texterの比較表にある「無制限」は、上限がまったく無いという意味ではありません。実際の条件は次のとおりです。</p>
<ul><li>音声・動画の取り込み（Whisper）：月の枠なし。1ファイル1GBまで、作成は1日300件まで</li><li>画像の文字起こし：1日1,000単位まで</li><li>翻訳（DeepLなどのクラウド翻訳）：1日10万字まで</li><li>要約、内容まとめ、AIチャット、ワードクラウド、話題マップ：アプリの回数の上限なし</li></ul>` },
  { id: 'ticket', title: '文字起こしチケットに含まれないもの', html: `<p>チケットで処理するときは、動画広告は表示されません。次の機能には使えません。</p>
<ul><li>リアルタイム文字起こし、音声入力キーボード</li><li>Amazon Transcribe、話者識別、取り込み時の自動無音カット</li><li>要約、AIチャット、翻訳、画像の文字起こしの回数</li></ul><p>チケットは、Whisperの無料枠を使い切ったときの上限画面に表示されます。表示されない場合もあります。Premiumに加入中の方と紹介特典を利用中の方には表示されません。</p>` },
  { id: 'charge', title: '追加チャージ', html: `<p>月の枠を超えて使いたいときは、次の追加チャージ（自動更新なし）を購入できます。追加できる量は、アプリの購入画面で確認してください。</p>
<ul><li>リアルタイム文字起こし：${yen(chargeRealtime)}</li><li>Amazon Transcribe：${yen(chargeAmazon)}</li><li>翻訳：${yen(chargeTranslate)}</li></ul>` },
  { id: 'android', title: 'iPhoneとAndroidの違い', html: `<p>このページの料金と上限は、iPhone版のものです。Android版の料金はGoogle Playで確認してください。次の点が異なります。</p>
<div class="scroll"><table class="compare"><thead><tr><th scope="col">項目</th><th scope="col">iPhone</th><th scope="col">Android</th></tr></thead><tbody>
<tr><th scope="row">無料のファイル文字起こし</th><td>処理時間の累積枠</td><td>別の枠（iPhoneとは共通ではありません）</td></tr>
<tr><th scope="row">文字起こしチケット</th><td>あり</td><td>確認日の時点で提供していません</td></tr>
<tr><th scope="row">追加チャージ</th><td>あり</td><td>確認日の時点で提供していません</td></tr>
<tr><th scope="row">音声入力キーボード</th><td>あり</td><td>なし</td></tr>
<tr><th scope="row">Apple Watchでの録音</th><td>あり</td><td>なし</td></tr>
</tbody></table></div>` },
  { id: 'not-suited', title: 'Texterが向いていない使い方', html: `<ul><li>無料のまま長時間をリアルタイムで記録したい場合：1回3分で止まる</li><li>無料枠で毎月ファイルを処理したい場合：iPhone版のWhisperの無料枠は累積する</li><li>通信なしで話者識別まで使いたい場合：話者識別には通信が必要。通信なしで使えるのは、対応端末のApple音声認識とSpeechAnalyzerだけ</li><li>チケットで2時間を超える音声を処理したい場合：Premiumが必要</li><li>複数の端末でノートを同期したい場合：同期の機能なし</li></ul>` },
  { id: 'method', title: '確認の方法', html: `<dl class="facts"><dt>確認日</dt><dd>${CHECKED}</dd><dt>確認した人</dt><dd>Texter運営</dd><dt>料金</dt><dd>App Store（日本）の表示</dd><dt>上限</dt><dd>iPhone版2.11.68の実装と、配信中の設定値</dd></dl><p class="note">上限は変わる場合があります。最新の内容は、アプリのプラン比較と購入画面で確認してください。よくある質問は<a href="/faq/">こちら</a>です。</p>` },
];

const page = {
  title: 'Texterの料金と利用条件｜無料枠、単発チケット、月額、年額の比較',
  description: `Texterの無料枠、文字起こしチケット（1時間${yen(ticket)}）、月額${yen(monthly)}、年額${yen(yearly)}を比較します。時間の数え方、1ファイルの上限、「無制限」の条件、iPhoneとAndroidの違いも載せています。`,
  h1: 'Texterの料金と利用条件',
  crumb: '料金と利用条件',
  lead: '無料版、単発の文字起こしチケット、月額、年額の違いを1ページにまとめました。',
};

const offers = [
  { name: '無料', price: 0 },
  { name: '文字起こしチケット（1時間）', price: ticket },
  { name: 'Premium 月額', price: monthly },
  { name: 'Premium 年額', price: yearly },
  { name: '月10時間プラン', price: tenHours },
  { name: '月20時間プラン', price: twentyHours },
];

module.exports = { CHECKED, questions, sections, page, offers };
