/**
 * Public-domain Japanese excerpts adapted from 青空文庫 (Aozora Bunko).
 * Source index: https://www.aozora.gr.jp/index_pages/sakuhin_a1.html
 * Readings use Aozora parenthesis form 漢字（かんじ） where present in the source.
 * Bare kanji are filled at runtime with Kuroshiro (see speaking/furigana.js).
 */

/**
 * Parse text that may include Aozora-style 漢字（よみ） into typed segments.
 * @param {string} raw
 * @returns {{ surface: string, kana: string | null }[]}
 */
export function segmentsFromAozoraText(raw) {
  const text = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/［＃[^\]]*］/g, '')
    .trim()
  /** @type {{ surface: string, kana: string | null }[]} */
  const segments = []
  const re =
    /([\u4E00-\u9FFF々〆ヵヶ]+)（([ぁ-んーァ-ヶー]+)）|([\u3040-\u309Fー]+)|([\u30A0-\u30FFー]+)|([\u4E00-\u9FFF々〆ヵヶ]+)|(\s+)|(.)/gu
  let m
  while ((m = re.exec(text))) {
    if (m[1] && m[2]) {
      const reading = m[2].replace(/[ァ-ヶ]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0x60),
      )
      segments.push({ surface: m[1], kana: reading, kanaFromSource: true })
    } else if (m[3]) {
      segments.push({ surface: m[3], kana: m[3], kanaFromSource: false })
    } else if (m[4]) {
      const hira = m[4].replace(/[ァ-ヶ]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0x60),
      )
      segments.push({ surface: m[4], kana: hira, kanaFromSource: false })
    } else if (m[5]) {
      // Kanji without reading — typing fills reading later; no source furigana
      segments.push({ surface: m[5], kana: null, kanaFromSource: false })
    } else if (m[6]) {
      if (m[6].includes('\n')) segments.push({ surface: '\n', kana: null, kanaFromSource: false })
      else segments.push({ surface: ' ', kana: null, kanaFromSource: false })
    } else if (m[7]) {
      segments.push({ surface: m[7], kana: null, kanaFromSource: false })
    }
  }
  return segments
}

/**
 * @param {string} title
 * @param {string} body
 */
function passage(title, body) {
  return { title, segments: segmentsFromAozoraText(body) }
}

/**
 * 太宰治『ア、秋』（青空文庫）抜粋 — 新字新仮名
 * https://www.aozora.gr.jp/cards/000035/card236.html
 */
const DAZAI_AKI = `本職の詩人ともなれば、いつどんな注文があるか、わからないから、常に詩材の準備をして置くのである。「秋について」という注文が来れば、よし来た、と「ア」の部の引き出しを開いて、愛、青、赤、アキ、いろいろのノオトがあって、そのうちの、あきの部のノオトを選び出し、落ちついてそのノオトを調べるのである。トンボ。スキトオル。と書いてある。秋になると、蜻蛉（とんぼ）も、ひ弱く、肉体は死んで、精神だけがふらふら飛んでいる様子を指して言っている言葉らしい。蜻蛉のからだが、秋の日ざしに、透きとおって見える。秋ハ夏ノ焼ケ残リサ。と書いてある。焦土である。夏ハ、シャンデリヤ。秋ハ、燈籠。とも書いてある。コスモス、無残。と書いてある。いつか郊外のおそばやで、ざるそば待っている間に、食卓の上の古いグラフを開いて見て、そのなかに大震災の写真があった。一面の焼野原、市松の浴衣（ゆかた）着た女が、たったひとり、疲れてしゃがんでいた。私は、胸が焼き焦げるほどにそのみじめな女を恋した。おそろしい情慾をさえ感じました。悲惨と情慾とはうらはらのものらしい。息がとまるほどに、苦しかった。枯野のコスモスに行き逢うと、私は、それと同じ痛苦を感じます。秋の朝顔も、コスモスと同じくらいに私を瞬時窒息させます。秋ハ夏ト同時ニヤッテ来ル。と書いてある。夏の中に、秋がこっそり隠れて、もはや来ているのであるが、人は、炎熱にだまされて、それを見破ることが出来ぬ。耳を澄まして注意をしていると、夏になると同時に、虫が鳴いているのだし、庭に気をくばって見ていると、桔梗（ききょう）の花も、夏になるとすぐ咲いているのを発見するし、蜻蛉だって、もともと夏の虫なんだし、柿も夏のうちにちゃんと実を結んでいるのだ。秋は、ずるい悪魔だ。夏のうちに全部、身支度をととのえて、せせら笑ってしゃがんでいる。僕くらいの炯眼（けいがん）の詩人になると、それを見破ることができる。家の者が、夏をよろこび海へ行こうか、山へ行こうかなど、はしゃいで言っているのを見ると、ふびんに思う。もう秋が夏と一緒に忍び込んで来ているのに。秋は、根強い曲者（くせもの）である。`

/**
 * 夏目漱石『こころ』冒頭部（青空文庫系テキスト、新字新仮名抜粋）
 * https://www.aozora.gr.jp/ （漱石「こころ」）
 */
const SOSEKI_KOKORO = `私（わたくし）はその人を常に先生と呼んでいた。だからここでもただ先生と書くだけで本名は打ち明けない。これは世間を憚（はばか）かる遠慮というよりも、その方が私にとって自然だからである。私はその人の記憶を呼び起こすごとに、すぐ「先生」といいたくなる。筆を執（と）っても心持は同じ事である。よそよそしい頭文字（かしらもじ）などはとても使う気にならない。私が先生と知り合いになったのは鎌倉である。その時私はまだ若々しい書生であった。暑中休暇を利用して海水浴に行った友達からぜひ来いという端書（はがき）を受け取ったので、私は多少の金を工面（くめん）して、出掛ける事にした。私は金の工面に二、三日を費やした。ところが私が鎌倉に着いて三、四日と経（た）たないうちに、私を呼び寄せた友達は、急に帰京しなければならなくなった。彼の母親が病気で、危篤（きとく）だという電報が来たのである。友達はそれで帰ってしまったが、残された私は鎌倉にぼんやり留（とま）っていた。友達が帰った後、私は毎日海へはいりに出かけた。私は熟練でない水泳者であった。それでもある程度まで泳ぐ事ができた。私はたいていは一人で海へはいって、一人で海から上がってきた。ある時私は先生と同じ湯に引き合わせた。私が先生を見たのはこれが最初である。`

/**
 * 太宰治『走れメロス』冒頭抜粋（青空文庫）
 * https://www.aozora.gr.jp/cards/000035/card1567.html
 */
const DAZAI_MEROS = `メロスは激怒した。必ず、かの邪智暴虐（じゃちぼうぎゃく）の王を除かなければならぬと決意した。メロスには政治がわからぬ。メロスは、村の牧人である。笛を吹き、羊と遊んで暮して来た。けれども邪悪に対しては、人一倍に敏感であった。きょう未明メロスは村を出発し、野を越え山越え、十里の道をトレトレと歩いて市に着いた。メロスには父も、母も無い。女房もない。十六の、内気な妹と二人暮しだ。この妹は、村のほとりの野原でも、羊の番をして遊んでいていい年ごろである。メロスは、それにしても、妹がおりを見て、この市へ羊を売りにやって来てくれたら、うれしく思う。妹は、朝から夕方まで、羊を追って歩き、夕餉（ゆうげ）の仕度をして、メロスの帰りを待つ。メロスは、妹のために、少しでも上等の衣裳（いしょう）を買って帰ろうと思った。市に着いて、メロスは王城の門前で、問答した。おまえは誰だ、と門番がきいた。メロスは、名乗り、用向きを告げた。市に出て羊を売るついでに、王の評判を聞きたいと思ったのである。門番は、ただ、むやみに睨（にら）んだ。おまえが、メロスという名なら、上へ通すわけにはいかぬ、と門番は言った。メロスは承知しなかった。妹のために上等のものを買うのが目的で、わざわざ市まで出て来たのだし、ついでに暴君の評判をきいておきたいだけではないか。門番は、なおも頑（がん）としてゆるさなかった。すると、メロスは、急に笑って、門番の頬（ほお）を一つ、ぴしゃりとぶった。門番は、よろけたが、すぐに立ち直って、メロスを組み伏せようとした。そこへ、別の兵卒が三人、飛び込んで来た。メロスは捕縛された。`

/** @type {{ title: string, segments: { surface: string, kana: string | null }[] }[]} */
export const AOZORA_PASSAGES = [
  passage('太宰治 · ア、秋（青空文庫）', DAZAI_AKI),
  passage('夏目漱石 · こころ（青空文庫抜粋）', SOSEKI_KOKORO),
  passage('太宰治 · 走れメロス（青空文庫抜粋）', DAZAI_MEROS),
]
