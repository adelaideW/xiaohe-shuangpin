/** Offline speaking lesson bank (ported from daily-language-practice). */

import { ARTICLES as ZH_ARTICLES, SENTENCES as ZH_SENTENCES } from '../data.js'

export const FALLBACK_LESSONS = {
  en: [
    {
      title: 'The Cost of Deciding',
      article: `By mid-afternoon, even disciplined people start making worse choices. Judges grant parole less often before lunch than after it. Shoppers abandon careful budgets after browsing a dozen aisles. Executives approve proposals they would have scrutinized that morning. Researchers call this pattern decision fatigue: the idea that the mental faculty we use to weigh options is not a fixed trait but a depletable resource, drained by every choice we make, trivial or consequential.

The theory grew out of a broader concept in psychology known as ego depletion, which held that self-control draws on a common reservoir of mental energy. Early experiments seemed to support this. Participants who resisted eating cookies gave up sooner on a difficult puzzle than participants who were allowed to indulge. Extend that logic to decision-making, and a plausible story emerges: each choice, however small, chips away at our capacity to choose well, until eventually we default to whatever is easiest, whether that is the status quo, the first available option, or no decision at all.

The practical implications are hard to ignore once you start looking for them. Retailers place impulse purchases near checkout lines precisely because shoppers there have already made dozens of decisions and have little resistance left. Some negotiators deliberately schedule difficult conversations late in the day, when the other party is more likely to concede simply to end the deliberation. Designers of digital products reduce the number of choices a user faces at any one screen, understanding that friction compounds over a session.

Yet the research base has grown more contested in recent years. Attempts to replicate the original ego-depletion studies have produced mixed results, and some scientists now argue that the effect, if it exists, is far smaller and more context-dependent than early reports suggested. Motivation and belief may matter as much as any literal depletion: people who believe willpower is a limited resource tend to show more fatigue-like effects than people who believe it is not, which hints that expectation shapes the outcome as much as biology does.

Whatever the precise mechanism, the practical remedies are similar to what conventional wisdom already recommended. Making important decisions earlier in the day, reducing the sheer number of trivial choices through routine, and building in deliberate breaks all appear to protect judgment quality, regardless of whether depletion is a literal resource or a psychological narrative that becomes self-fulfilling. For professionals who spend entire days choosing between competing priorities, the lesson is less about willpower as a muscle to be conserved and more about designing an environment that does not demand peak discernment at every turn.`,
      estimatedMinutes: 5,
      words: [
        { word: 'depletable', reading: '', meaning: 'able to be gradually used up or exhausted', example: 'The team treated attention as a depletable resource and scheduled the hardest tasks for the morning.', exampleTranslation: '' },
        { word: 'reservoir', reading: '', meaning: 'a store or supply of something, held in reserve', example: 'She kept a reservoir of patience for the busiest hours of her shift.', exampleTranslation: '' },
        { word: 'replicate', reading: '', meaning: 'to reproduce or repeat a study to see if the results hold', example: 'Other labs struggled to replicate the original finding under stricter conditions.', exampleTranslation: '' },
        { word: 'context-dependent', reading: '', meaning: 'varying based on the specific situation or circumstances', example: 'The effect turned out to be highly context-dependent, appearing only under stress.', exampleTranslation: '' },
        { word: 'self-fulfilling', reading: '', meaning: 'becoming true simply because it was believed or predicted', example: 'His fear of failing became a self-fulfilling prophecy once he stopped preparing.', exampleTranslation: '' },
      ],
    },
    {
      title: 'Attention as Currency',
      article: `For most of the twentieth century, advertisers competed for space: a page in a magazine, a slot between television programs, a billboard along a highway. Space was finite, and its scarcity set the price. The internet inverted that constraint. Publishing became nearly free, and the volume of available content grew far faster than any individual's capacity to consume it. What became scarce instead was attention itself, and an entire industry rearranged itself around capturing, measuring, and reselling it.

This shift, now commonly described as the attention economy, treats human focus as the fundamental unit of value. Platforms do not primarily sell products to users; they sell users' attention to advertisers, and the currency in which they are paid is time on screen. This reframing explains design choices that might otherwise seem irrational from a pure user-experience standpoint: autoplaying videos, infinite scroll, notification badges engineered to trigger a reflexive check. None of these features make the underlying product more useful. They make it more retentive.

Critics argue that this incentive structure produces a systematic mismatch between what technology companies optimize for and what users would choose if given full information and self-control. A feed engineered to maximize engagement will favor content that provokes strong emotional reactions, since outrage and anxiety hold attention more reliably than calm reflection. Over time, this can degrade the quality of public discourse, not because any single actor intends harm, but because the aggregate effect of many small optimizations pushes in that direction.

Defenders counter that attention has always been a scarce resource that institutions competed for, from church bells to town criers, and that framing today's platforms as uniquely manipulative ignores this long history. They also point out that users retain considerable agency: notification settings can be adjusted, apps can be deleted, and market pressure has already pushed some companies to introduce screen-time dashboards and gentler defaults, however imperfect.

What seems clear is that attention, once treated as an incidental byproduct of good products, is now a deliberately engineered outcome, measured in dashboards down to the second. Understanding this shift matters beyond individual habits. It shapes how information spreads, which ideas gain visibility, and ultimately which version of events a society comes to treat as true, since in an economy built on attention, what cannot capture it effectively does not exist in the public conversation at all.`,
      estimatedMinutes: 5,
      words: [
        { word: 'scarcity', reading: '', meaning: 'the state of being in short supply', example: 'Housing scarcity in the city has pushed rents to record highs.', exampleTranslation: '' },
        { word: 'reframing', reading: '', meaning: 'presenting or interpreting a situation from a new perspective', example: 'The consultant\'s reframing of the problem helped the team see a solution they had missed.', exampleTranslation: '' },
        { word: 'retentive', reading: '', meaning: 'tending to keep or hold onto something, here: keeping users engaged', example: 'The app\'s design is highly retentive, pulling users back every few minutes.', exampleTranslation: '' },
        { word: 'discourse', reading: '', meaning: 'communication or debate, especially on a public or serious topic', example: 'Civil discourse has become harder to sustain on platforms built for outrage.', exampleTranslation: '' },
        { word: 'aggregate', reading: '', meaning: 'formed by combining several separate elements into a total', example: 'The aggregate effect of thousands of small design choices reshaped how people read news.', exampleTranslation: '' },
      ],
    },
    {
      title: 'Reefs Under Pressure',
      article: `Coral reefs occupy less than one percent of the ocean floor, yet they support roughly a quarter of all known marine species, a disproportion that has earned them the nickname "rainforests of the sea." That richness depends on a fragile partnership: coral polyps host microscopic algae called zooxanthellae within their tissue, and the algae, in exchange for shelter, supply the coral with the bulk of its energy through photosynthesis. This symbiosis is also the reef's greatest vulnerability.

When ocean temperatures rise even slightly above a coral's normal tolerance, the relationship breaks down. Stressed corals expel their resident algae, and because the algae also provide much of the coral's color, the tissue turns pale or white, a phenomenon known as bleaching. A bleached coral is not immediately dead; it can recover if temperatures drop and algae recolonize in time. But prolonged or repeated heat stress leaves the coral without its main energy source, and starvation eventually sets in.

Mass bleaching events, once rare enough to be treated as anomalies, have become alarmingly routine. The Great Barrier Reef has experienced several basin-wide bleaching episodes within a single decade, a frequency that leaves little time for recovery between events. Marine biologists now track heat stress using accumulated thermal exposure over weeks, since a brief spike is far less damaging than sustained elevated temperatures.

Not all corals respond identically, and this variation has become a focus of active research. Some coral colonies harbor algae strains that tolerate heat better, and reefs exposed to naturally fluctuating temperatures, such as those near river mouths or in shallow lagoons, sometimes show greater resilience than reefs in more stable environments, possibly because prior exposure to stress primes a more robust response. Scientists have begun experimenting with selectively breeding heat-tolerant coral strains and even relocating them to reefs at risk, though such interventions remain small in scale relative to the scope of the problem.

The stakes extend well beyond the reefs themselves. Coastal communities rely on reef fisheries for protein and income, and reef structures buffer shorelines against storm surge, a service that becomes more valuable as sea levels rise. Losing reef ecosystems would not simply mean losing biodiversity in some distant ocean; for millions of people living along tropical coastlines, it would mean losing a food source, an economic base, and a physical barrier against an increasingly volatile sea.`,
      estimatedMinutes: 5,
      words: [
        { word: 'symbiosis', reading: '', meaning: 'a close, mutually beneficial relationship between two different organisms', example: 'The symbiosis between the clownfish and the anemone protects both species.', exampleTranslation: '' },
        { word: 'bleaching', reading: '', meaning: 'the process by which coral loses its color after expelling its algae under stress', example: 'Scientists documented severe bleaching across the reef after weeks of record heat.', exampleTranslation: '' },
        { word: 'anomalies', reading: '', meaning: 'things that deviate from what is standard or expected', example: 'The early data points were dismissed as anomalies until the pattern repeated.', exampleTranslation: '' },
        { word: 'resilience', reading: '', meaning: 'the capacity to recover quickly from difficulty or stress', example: 'The startup\'s resilience during the downturn impressed even its harshest critics.', exampleTranslation: '' },
        { word: 'buffer', reading: '', meaning: 'to lessen or absorb the impact of something', example: 'Wetlands buffer nearby towns from the worst effects of coastal flooding.', exampleTranslation: '' },
      ],
    },
    {
      title: 'The Ledger That Built Modern Trade',
      article: `Long before spreadsheets or accounting software, merchants in Renaissance Italy faced a problem that seems almost quaint today: how to know, with confidence, whether a business was actually making money. Single-entry bookkeeping, the dominant method at the time, recorded transactions as a simple list of income and expenses. It was easy to falsify, difficult to audit, and prone to errors that could go unnoticed for years. Double-entry bookkeeping solved this by recording every transaction twice, once as a debit and once as a corresponding credit, so that the books had to balance if the records were accurate.

The method is often credited to Luca Pacioli, a Franciscan friar and mathematician who published a detailed description of the technique in 1494, though the practice itself likely predates his writing by more than a century among merchants in Genoa, Florence, and Venice. Pacioli's contribution was less invention than codification: he gathered an existing practical technique and explained it systematically enough that it could spread well beyond the small circle of merchants who had developed it through trial and error.

What made double-entry bookkeeping transformative was not merely its accuracy but the kind of institution it made possible. A business owner using single-entry methods could reasonably track a small operation from memory and a simple ledger. But partnerships involving multiple investors, extended trade routes, and long delays between an expenditure and its eventual return demanded a system that could be verified by someone other than the person who kept the books. Double-entry accounting gave outside investors a reason to trust records they had not personally kept, which in turn made it possible to raise capital from people who were not directly involved in day-to-day operations.

This trust infrastructure proved essential to the joint-stock company and, later, to the modern corporation. Investors could commit funds to ventures they would never personally oversee because a shared accounting standard made the resulting financial statements legible and comparable across firms. Banks could extend credit against verifiable records rather than personal reputation alone. Governments could tax business activity with more confidence in the reported figures.

It is easy to treat bookkeeping as a mundane, purely technical exercise, but the historical record suggests otherwise. A relatively simple change in how transactions were recorded quietly reshaped what forms of economic cooperation were even possible, enabling strangers to pool capital, trust distant partners, and build institutions that outlasted any single merchant's working life.`,
      estimatedMinutes: 5,
      words: [
        { word: 'quaint', reading: '', meaning: 'attractively unusual or old-fashioned, sometimes with a hint of naivety', example: 'The office still used a quaint paper filing system well into the 2010s.', exampleTranslation: '' },
        { word: 'codification', reading: '', meaning: 'the act of arranging existing knowledge or rules into a systematic form', example: 'The manual was less a new invention than a codification of best practices already in use.', exampleTranslation: '' },
        { word: 'ledger', reading: '', meaning: 'a book or record of financial transactions', example: 'She traced the discrepancy back through three years of the company\'s ledger.', exampleTranslation: '' },
        { word: 'legible', reading: '', meaning: 'clear enough to be read or understood', example: 'The new reporting format made quarterly results far more legible to outside investors.', exampleTranslation: '' },
        { word: 'infrastructure', reading: '', meaning: 'the underlying systems and structures that support a larger operation', example: 'Reliable shipping infrastructure was as important to the trade route as the goods themselves.', exampleTranslation: '' },
      ],
    },
  ],
  ja: [
    {
      title: '週末の予定',
      article: `今週の週末は久しぶりに何も予定がないので、少しゆっくりしようと思っています。土曜日の朝は、いつもより遅く起きて、近くの公園を散歩するつもりです。最近、天気がいい日が続いているので、外を歩くのがとても気持ちいいです。

お昼は友達と駅前の新しいカフェに行く約束をしています。そのカフェはSNSで話題になっていて、写真もとてもきれいでした。パンケーキが人気らしいので、二人で頼んでみようと話しています。友達とは久しぶりに会うので、最近あったことをゆっくり話したいです。

午後は特に予定がないので、家で本を読んだり、映画を見たりするかもしれません。実は先週買った本がまだ読み終わっていないので、少しずつ読み進めたいです。夜は簡単な料理を作って、早めに寝るつもりです。日曜日は掃除と洗濯をして、来週の準備をしようと思っています。`,
      estimatedMinutes: 4,
      words: [
        { word: '久しぶり', reading: 'ひさしぶり', meaning: 'after a long time / it\'s been a while', example: '久しぶりに大学の友達に会った。', exampleTranslation: 'I met my college friend for the first time in a long while.' },
        { word: '話題になる', reading: 'わだいになる', meaning: 'to become a topic of conversation / to become popular talk', example: 'この店は最近、話題になっている。', exampleTranslation: 'This shop has become popular talk recently.' },
        { word: '読み進める', reading: 'よみすすめる', meaning: 'to keep reading / to make progress reading', example: '忙しくて本を読み進めることができなかった。', exampleTranslation: 'I was too busy to keep making progress reading the book.' },
        { word: 'ゆっくりする', reading: 'ゆっくりする', meaning: 'to relax / to take it easy', example: '疲れたので、今日は家でゆっくりする。', exampleTranslation: 'I\'m tired, so I\'ll relax at home today.' },
        { word: '準備をする', reading: 'じゅんびをする', meaning: 'to prepare / to get ready', example: '旅行の準備をするのに時間がかかった。', exampleTranslation: 'It took time to prepare for the trip.' },
      ],
    },
    {
      title: '新しいカフェ',
      article: `先週、会社の近くに新しいカフェがオープンしました。前を通るたびに気になっていたので、今日の昼休みに初めて入ってみました。店内はとても静かで、木のテーブルと椅子がたくさん並んでいました。窓が大きくて、外の景色がよく見えるのも気に入りました。

メニューを見ると、コーヒーの種類がとても多くて、どれにするか迷ってしまいました。店員さんに人気のメニューを聞いたら、季節限定のカフェラテを勧めてくれたので、それを頼んでみることにしました。少し甘くて、とてもおいしかったです。

一緒に頼んだサンドイッチも野菜がたっぷり入っていて、健康的な感じがしました。値段は少し高めでしたが、雰囲気がいいので、また来たいと思いました。同僚にも教えてあげたら、みんな行ってみたいと言っていました。今度は休みの日に、もう少しゆっくり過ごしに来たいです。`,
      estimatedMinutes: 4,
      words: [
        { word: '気になる', reading: 'きになる', meaning: 'to be curious about / to be on one\'s mind', example: 'あの新しい映画がずっと気になっている。', exampleTranslation: 'That new movie has been on my mind for a while.' },
        { word: '迷う', reading: 'まよう', meaning: 'to be unable to decide / to hesitate', example: 'どちらの服を買うか迷っている。', exampleTranslation: 'I can\'t decide which clothes to buy.' },
        { word: '季節限定', reading: 'きせつげんてい', meaning: 'seasonal limited edition', example: '季節限定のケーキを買いに行った。', exampleTranslation: 'I went to buy the seasonal limited-edition cake.' },
        { word: 'たっぷり', reading: 'たっぷり', meaning: 'plentifully / in abundance', example: '野菜がたっぷり入ったスープが好きだ。', exampleTranslation: 'I like soup that\'s full of plenty of vegetables.' },
        { word: '雰囲気', reading: 'ふんいき', meaning: 'atmosphere / ambience', example: 'このレストランは雰囲気がとてもいい。', exampleTranslation: 'This restaurant has a really nice atmosphere.' },
      ],
    },
    {
      title: '引っ越しの話',
      article: `来月、今の部屋から新しいアパートに引っ越すことになりました。今の部屋に住んで三年になりますが、会社まで少し遠いので、もっと近い場所を探していました。先週、駅から歩いて五分のアパートを見つけて、すぐに契約を決めました。

引っ越しは初めてではありませんが、荷物が多くて少し大変です。特に本と食器が多くて、箱に詰めるのに時間がかかっています。週末に友達が手伝いに来てくれることになったので、少し安心しました。

新しいアパートは前の部屋より少し狭いですが、駅に近いので、朝の時間に余裕ができそうです。近くにスーパーやコンビニもあるので、生活はとても便利になると思います。引っ越しの日は業者にお願いする予定ですが、それでもやることがたくさんあって、少し疲れそうです。早く新しい生活に慣れたいです。`,
      estimatedMinutes: 4,
      words: [
        { word: '契約', reading: 'けいやく', meaning: 'contract / agreement', example: 'アパートの契約を来週するつもりだ。', exampleTranslation: 'I plan to sign the apartment contract next week.' },
        { word: '詰める', reading: 'つめる', meaning: 'to pack / to stuff into', example: 'スーツケースに服をたくさん詰めた。', exampleTranslation: 'I packed a lot of clothes into the suitcase.' },
        { word: '余裕ができる', reading: 'よゆうができる', meaning: 'to have (more) room/leeway, e.g. in time or money', example: '引っ越してから、朝の時間に余裕ができた。', exampleTranslation: 'Since moving, I\'ve had more leeway in my morning time.' },
        { word: '業者', reading: 'ぎょうしゃ', meaning: 'a company/vendor providing a service (e.g. movers)', example: '引っ越しの業者にお願いすることにした。', exampleTranslation: 'I decided to ask a moving company for help.' },
        { word: '慣れる', reading: 'なれる', meaning: 'to get used to / to become accustomed to', example: '新しい仕事にまだ慣れていない。', exampleTranslation: 'I\'m not used to the new job yet.' },
      ],
    },
    {
      title: '雨の日の過ごし方',
      article: `今日は朝から雨が降っていて、外に出るのが少し面倒だなと思いました。でも、雨の日には雨の日なりの楽しみ方があると気づいてから、前ほど嫌いではなくなりました。今日は久しぶりに家でゆっくり過ごすことにしました。

まず、お気に入りの音楽をかけながら、部屋の掃除をしました。窓の外の雨の音を聞きながら掃除をすると、なぜか気持ちが落ち着きます。掃除が終わったあとは、温かいお茶を入れて、ソファでのんびり本を読みました。

お昼は冷蔵庫にあった野菜でスープを作りました。寒い日に温かいスープを飲むと、体も心もほっとします。午後は録画していたドラマを見て過ごしました。こんな静かな一日も、たまにはいいなと思います。明日は晴れるといいのですが、今日はこのまま雨の音を楽しみたいと思います。`,
      estimatedMinutes: 4,
      words: [
        { word: '面倒', reading: 'めんどう', meaning: 'troublesome / a hassle', example: '雨の日に出かけるのは面倒だ。', exampleTranslation: 'Going out on a rainy day is a hassle.' },
        { word: '気づく', reading: 'きづく', meaning: 'to notice / to realize', example: '財布を忘れたことに駅で気づいた。', exampleTranslation: 'I noticed I had forgotten my wallet at the station.' },
        { word: '落ち着く', reading: 'おちつく', meaning: 'to calm down / to feel settled', example: 'お茶を飲むと気持ちが落ち着く。', exampleTranslation: 'Drinking tea calms me down.' },
        { word: 'ほっとする', reading: 'ほっとする', meaning: 'to feel relieved / to feel at ease', example: '試験が終わって、ほっとした。', exampleTranslation: 'I felt relieved once the exam was over.' },
        { word: 'たまには', reading: 'たまには', meaning: 'once in a while / occasionally', example: 'たまには何もしない日があってもいい。', exampleTranslation: 'It\'s fine to have a do-nothing day once in a while.' },
      ],
    },
  ],
};

/** Built-in Chinese speaking bank from typing passages + short prose. */
function chineseLessons() {
  const fromArticles = ZH_ARTICLES.map((a) => ({
    title: a.title,
    article: a.text,
    estimatedMinutes: Math.max(1, Math.ceil([...a.text].filter((c) => /[\u4e00-\u9fff]/.test(c)).length / 35)),
    words: [],
  }))

  // Bundle everyday sentences into multi-sentence practice cards
  const chunks = []
  for (let i = 0; i < ZH_SENTENCES.length; i += 3) {
    const group = ZH_SENTENCES.slice(i, i + 3)
    chunks.push({
      title: `日常会话 · ${group.map((g) => g.title).join(' / ')}`,
      article: group.map((g) => g.text).join(''),
      estimatedMinutes: 2,
      words: [],
    })
  }

  const prose = [
    {
      title: '周末计划',
      article:
        '这个周末我想先把房间收拾干净，然后去超市买一点新鲜的水果和面包。下午如果天气好，就和朋友一起去公园散步。晚上回家后泡杯茶，看一集喜欢的纪录片，早一点休息。',
      estimatedMinutes: 3,
      words: [
        { word: '收拾', reading: 'shōushi', meaning: 'to tidy up', example: '周末我想先把房间收拾干净。', exampleTranslation: '' },
        { word: '新鲜', reading: 'xīnxiān', meaning: 'fresh', example: '去超市买一点新鲜的水果。', exampleTranslation: '' },
        { word: '纪录片', reading: 'jìlùpiàn', meaning: 'documentary', example: '看一集喜欢的纪录片。', exampleTranslation: '' },
      ],
    },
    {
      title: '学习双拼',
      article:
        '刚开始学双拼的时候会觉得有点别扭，手指总想回到原来的全拼位置。可是坚持练习两周以后，打字速度明显快了。现在我写邮件和记笔记几乎都用双拼，错误也越来越少。',
      estimatedMinutes: 3,
      words: [
        { word: '别扭', reading: 'bièniu', meaning: 'awkward / uncomfortable', example: '刚开始会觉得有点别扭。', exampleTranslation: '' },
        { word: '坚持', reading: 'jiānchí', meaning: 'to persist', example: '坚持练习两周以后。', exampleTranslation: '' },
        { word: '明显', reading: 'míngxiǎn', meaning: 'obvious / clear', example: '打字速度明显快了。', exampleTranslation: '' },
      ],
    },
    {
      title: '城市早晨',
      article:
        '清晨的地铁站已经很热闹了。有人低头看手机，有人匆匆奔跑赶车。车厢里安静得只听见列车轨道的声音。我站在门边，看着窗外的建筑一栋栋掠过，心里盘算着今天要完成的几件事。',
      estimatedMinutes: 3,
      words: [
        { word: '热闹', reading: 'rènao', meaning: 'lively / bustling', example: '清晨的地铁站已经很热闹了。', exampleTranslation: '' },
        { word: '匆匆', reading: 'cōngcōng', meaning: 'hastily', example: '有人匆匆奔跑赶车。', exampleTranslation: '' },
        { word: '盘算', reading: 'pánsuàn', meaning: 'to calculate / plan', example: '心里盘算着今天要完成的几件事。', exampleTranslation: '' },
      ],
    },
  ]

  return [...prose, ...chunks, ...fromArticles]
}

/**
 * @param {'en' | 'ja' | 'zh'} language
 * @param {string[]} [avoidTitles]
 */
export function pickLesson(language, avoidTitles = []) {
  const bank =
    language === 'zh' ? chineseLessons() : FALLBACK_LESSONS[language] || []
  const avoidSet = new Set(avoidTitles)
  const candidates = bank.filter((l) => !avoidSet.has(l.title))
  const pool = candidates.length ? candidates : bank
  const pick = pool[Math.floor(Math.random() * pool.length)]
  return { ...pick, language, source: 'fallback' }
}
