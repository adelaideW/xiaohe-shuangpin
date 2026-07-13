/** Practice content: characters, sentences, articles — each item has hanzi + pinyin syllables. */

export const CHARACTERS = [
  { char: '中', pinyin: 'zhong' },
  { char: '国', pinyin: 'guo' },
  { char: '人', pinyin: 'ren' },
  { char: '大', pinyin: 'da' },
  { char: '小', pinyin: 'xiao' },
  { char: '上', pinyin: 'shang' },
  { char: '下', pinyin: 'xia' },
  { char: '天', pinyin: 'tian' },
  { char: '地', pinyin: 'di' },
  { char: '水', pinyin: 'shui' },
  { char: '火', pinyin: 'huo' },
  { char: '山', pinyin: 'shan' },
  { char: '木', pinyin: 'mu' },
  { char: '金', pinyin: 'jin' },
  { char: '月', pinyin: 'yue' },
  { char: '日', pinyin: 'ri' },
  { char: '年', pinyin: 'nian' },
  { char: '时', pinyin: 'shi' },
  { char: '分', pinyin: 'fen' },
  { char: '秒', pinyin: 'miao' },
  { char: '你', pinyin: 'ni' },
  { char: '我', pinyin: 'wo' },
  { char: '他', pinyin: 'ta' },
  { char: '她', pinyin: 'ta' },
  { char: '们', pinyin: 'men' },
  { char: '的', pinyin: 'de' },
  { char: '是', pinyin: 'shi' },
  { char: '不', pinyin: 'bu' },
  { char: '了', pinyin: 'le' },
  { char: '在', pinyin: 'zai' },
  { char: '有', pinyin: 'you' },
  { char: '这', pinyin: 'zhe' },
  { char: '那', pinyin: 'na' },
  { char: '来', pinyin: 'lai' },
  { char: '去', pinyin: 'qu' },
  { char: '说', pinyin: 'shuo' },
  { char: '看', pinyin: 'kan' },
  { char: '听', pinyin: 'ting' },
  { char: '想', pinyin: 'xiang' },
  { char: '做', pinyin: 'zuo' },
  { char: '学', pinyin: 'xue' },
  { char: '习', pinyin: 'xi' },
  { char: '双', pinyin: 'shuang' },
  { char: '拼', pinyin: 'pin' },
  { char: '输', pinyin: 'shu' },
  { char: '入', pinyin: 'ru' },
  { char: '法', pinyin: 'fa' },
  { char: '键', pinyin: 'jian' },
  { char: '盘', pinyin: 'pan' },
  { char: '练', pinyin: 'lian' },
  { char: '习', pinyin: 'xi' },
  { char: '秋', pinyin: 'qiu' },
  { char: '春', pinyin: 'chun' },
  { char: '夏', pinyin: 'xia' },
  { char: '冬', pinyin: 'dong' },
  { char: '风', pinyin: 'feng' },
  { char: '雨', pinyin: 'yu' },
  { char: '云', pinyin: 'yun' },
  { char: '雪', pinyin: 'xue' },
  { char: '花', pinyin: 'hua' },
  { char: '草', pinyin: 'cao' },
  { char: '树', pinyin: 'shu' },
  { char: '鸟', pinyin: 'niao' },
  { char: '鱼', pinyin: 'yu' },
  { char: '猫', pinyin: 'mao' },
  { char: '狗', pinyin: 'gou' },
  { char: '家', pinyin: 'jia' },
  { char: '门', pinyin: 'men' },
  { char: '窗', pinyin: 'chuang' },
  { char: '书', pinyin: 'shu' },
  { char: '笔', pinyin: 'bi' },
  { char: '纸', pinyin: 'zhi' },
  { char: '电', pinyin: 'dian' },
  { char: '脑', pinyin: 'nao' },
  { char: '手', pinyin: 'shou' },
  { char: '机', pinyin: 'ji' },
  { char: '好', pinyin: 'hao' },
  { char: '坏', pinyin: 'huai' },
  { char: '快', pinyin: 'kuai' },
  { char: '慢', pinyin: 'man' },
  { char: '高', pinyin: 'gao' },
  { char: '低', pinyin: 'di' },
  { char: '多', pinyin: 'duo' },
  { char: '少', pinyin: 'shao' },
  { char: '东', pinyin: 'dong' },
  { char: '西', pinyin: 'xi' },
  { char: '南', pinyin: 'nan' },
  { char: '北', pinyin: 'bei' },
  { char: '左', pinyin: 'zuo' },
  { char: '右', pinyin: 'you' },
  { char: '前', pinyin: 'qian' },
  { char: '后', pinyin: 'hou' },
  { char: '里', pinyin: 'li' },
  { char: '外', pinyin: 'wai' },
  { char: '开', pinyin: 'kai' },
  { char: '关', pinyin: 'guan' },
  { char: '进', pinyin: 'jin' },
  { char: '出', pinyin: 'chu' },
  { char: '起', pinyin: 'qi' },
  { char: '坐', pinyin: 'zuo' },
  { char: '走', pinyin: 'zou' },
  { char: '跑', pinyin: 'pao' },
  { char: '飞', pinyin: 'fei' },
  { char: '吃', pinyin: 'chi' },
  { char: '喝', pinyin: 'he' },
  { char: '睡', pinyin: 'shui' },
  { char: '觉', pinyin: 'jiao' },
  { char: '爱', pinyin: 'ai' },
  { char: '乐', pinyin: 'le' },
  { char: '喜', pinyin: 'xi' },
  { char: '欢', pinyin: 'huan' },
  { char: '美', pinyin: 'mei' },
  { char: '丽', pinyin: 'li' },
  { char: '新', pinyin: 'xin' },
  { char: '旧', pinyin: 'jiu' },
  { char: '白', pinyin: 'bai' },
  { char: '黑', pinyin: 'hei' },
  { char: '红', pinyin: 'hong' },
  { char: '蓝', pinyin: 'lan' },
  { char: '绿', pinyin: 'lü' },
  { char: '黄', pinyin: 'huang' },
  { char: '一', pinyin: 'yi' },
  { char: '二', pinyin: 'er' },
  { char: '三', pinyin: 'san' },
  { char: '四', pinyin: 'si' },
  { char: '五', pinyin: 'wu' },
  { char: '六', pinyin: 'liu' },
  { char: '七', pinyin: 'qi' },
  { char: '八', pinyin: 'ba' },
  { char: '九', pinyin: 'jiu' },
  { char: '十', pinyin: 'shi' },
  { char: '百', pinyin: 'bai' },
  { char: '千', pinyin: 'qian' },
  { char: '万', pinyin: 'wan' },
  { char: '工', pinyin: 'gong' },
  { char: '作', pinyin: 'zuo' },
  { char: '生', pinyin: 'sheng' },
  { char: '活', pinyin: 'huo' },
  { char: '朋', pinyin: 'peng' },
  { char: '友', pinyin: 'you' },
  { char: '同', pinyin: 'tong' },
  { char: '学', pinyin: 'xue' },
  { char: '老', pinyin: 'lao' },
  { char: '师', pinyin: 'shi' },
  { char: '爸', pinyin: 'ba' },
  { char: '妈', pinyin: 'ma' },
  { char: '哥', pinyin: 'ge' },
  { char: '姐', pinyin: 'jie' },
  { char: '弟', pinyin: 'di' },
  { char: '妹', pinyin: 'mei' },
  { char: '孩', pinyin: 'hai' },
  { char: '子', pinyin: 'zi' },
  { char: '今', pinyin: 'jin' },
  { char: '明', pinyin: 'ming' },
  { char: '昨', pinyin: 'zuo' },
  { char: '早', pinyin: 'zao' },
  { char: '晚', pinyin: 'wan' },
  { char: '星', pinyin: 'xing' },
  { char: '期', pinyin: 'qi' },
  { char: '周', pinyin: 'zhou' },
  { char: '点', pinyin: 'dian' },
  { char: '半', pinyin: 'ban' },
  { char: '请', pinyin: 'qing' },
  { char: '问', pinyin: 'wen' },
  { char: '谢', pinyin: 'xie' },
  { char: '对', pinyin: 'dui' },
  { char: '不', pinyin: 'bu' },
  { char: '起', pinyin: 'qi' },
  { char: '没', pinyin: 'mei' },
  { char: '关', pinyin: 'guan' },
  { char: '系', pinyin: 'xi' },
  { char: '可', pinyin: 'ke' },
  { char: '以', pinyin: 'yi' },
  { char: '能', pinyin: 'neng' },
  { char: '会', pinyin: 'hui' },
  { char: '要', pinyin: 'yao' },
  { char: '应', pinyin: 'ying' },
  { char: '该', pinyin: 'gai' },
  { char: '知', pinyin: 'zhi' },
  { char: '道', pinyin: 'dao' },
  { char: '认', pinyin: 'ren' },
  { char: '识', pinyin: 'shi' },
  { char: '觉', pinyin: 'jue' },
  { char: '得', pinyin: 'de' },
  { char: '感', pinyin: 'gan' },
  { char: '觉', pinyin: 'jue' },
  { char: '希', pinyin: 'xi' },
  { char: '望', pinyin: 'wang' },
  { char: '成', pinyin: 'cheng' },
  { char: '功', pinyin: 'gong' },
  { char: '努', pinyin: 'nu' },
  { char: '力', pinyin: 'li' },
  { char: '坚', pinyin: 'jian' },
  { char: '持', pinyin: 'chi' },
  { char: '效', pinyin: 'xiao' },
  { char: '率', pinyin: 'lü' },
  { char: '准', pinyin: 'zhun' },
  { char: '确', pinyin: 'que' },
  { char: '速', pinyin: 'su' },
  { char: '度', pinyin: 'du' },
]

/**
 * @typedef {{ text: string, pinyin: string[] }} Line
 * pinyin array aligns 1:1 with Chinese chars (punctuation skipped in typing).
 */

export const SENTENCES = [
  {
    title: '问候',
    text: '你好，今天天气真好。',
    pinyin: ['ni', 'hao', null, 'jin', 'tian', 'tian', 'qi', 'zhen', 'hao', null],
  },
  {
    title: '学习',
    text: '我正在练习小鹤双拼输入法。',
    pinyin: ['wo', 'zheng', 'zai', 'lian', 'xi', 'xiao', 'he', 'shuang', 'pin', 'shu', 'ru', 'fa', null],
  },
  {
    title: '效率',
    text: '双拼可以让打字更快更轻松。',
    pinyin: ['shuang', 'pin', 'ke', 'yi', 'rang', 'da', 'zi', 'geng', 'kuai', 'geng', 'qing', 'song', null],
  },
  {
    title: '坚持',
    text: '每天练习十分钟，进步会很明显。',
    pinyin: ['mei', 'tian', 'lian', 'xi', 'shi', 'fen', 'zhong', null, 'jin', 'bu', 'hui', 'hen', 'ming', 'xian', null],
  },
  {
    title: '生活',
    text: '春天来了，花儿开了，鸟儿飞了。',
    pinyin: ['chun', 'tian', 'lai', 'le', null, 'hua', 'er', 'kai', 'le', null, 'niao', 'er', 'fei', 'le', null],
  },
  {
    title: '工作',
    text: '请把这份文件发给相关同事。',
    pinyin: ['qing', 'ba', 'zhe', 'fen', 'wen', 'jian', 'fa', 'gei', 'xiang', 'guan', 'tong', 'shi', null],
  },
  {
    title: '旅行',
    text: '我们周末去山里看风景吧。',
    pinyin: ['wo', 'men', 'zhou', 'mo', 'qu', 'shan', 'li', 'kan', 'feng', 'jing', 'ba', null],
  },
  {
    title: '阅读',
    text: '一本好书能打开全新的世界。',
    pinyin: ['yi', 'ben', 'hao', 'shu', 'neng', 'da', 'kai', 'quan', 'xin', 'de', 'shi', 'jie', null],
  },
  {
    title: '美食',
    text: '这家餐厅的红烧肉特别好吃。',
    pinyin: ['zhe', 'jia', 'can', 'ting', 'de', 'hong', 'shao', 'rou', 'te', 'bie', 'hao', 'chi', null],
  },
  {
    title: '运动',
    text: '下班以后我喜欢跑步和游泳。',
    pinyin: ['xia', 'ban', 'yi', 'hou', 'wo', 'xi', 'huan', 'pao', 'bu', 'he', 'you', 'yong', null],
  },
  {
    title: '科技',
    text: '人工智能正在改变我们的生活。',
    pinyin: ['ren', 'gong', 'zhi', 'neng', 'zheng', 'zai', 'gai', 'bian', 'wo', 'men', 'de', 'sheng', 'huo', null],
  },
  {
    title: '友情',
    text: '真正的朋友会在你需要时出现。',
    pinyin: ['zhen', 'zheng', 'de', 'peng', 'you', 'hui', 'zai', 'ni', 'xu', 'yao', 'shi', 'chu', 'xian', null],
  },
]

export function isHanzi(ch) {
  return /[\u4e00-\u9fff]/.test(ch)
}

/**
 * Build a passage from text + hanzi-only pinyin list (punctuation → null).
 * @param {string} title
 * @param {string} text
 * @param {string[]} syllables
 */
export function makePassage(title, text, syllables) {
  const pinyin = []
  let si = 0
  for (const ch of text) {
    if (isHanzi(ch)) {
      if (si >= syllables.length) {
        throw new Error(`Missing pinyin for「${ch}」in ${title}`)
      }
      pinyin.push(syllables[si++])
    } else {
      pinyin.push(null)
    }
  }
  if (si !== syllables.length) {
    throw new Error(`Extra pinyin in ${title}: got ${syllables.length}, used ${si}`)
  }
  return { title, text, pinyin }
}

/** Classic Tang poems for article practice. */
export const ARTICLES = [
  makePassage(
    '静夜思 · 李白',
    '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
    [
      'chuang', 'qian', 'ming', 'yue', 'guang',
      'yi', 'shi', 'di', 'shang', 'shuang',
      'ju', 'tou', 'wang', 'ming', 'yue',
      'di', 'tou', 'si', 'gu', 'xiang',
    ],
  ),
  makePassage(
    '春晓 · 孟浩然',
    '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。',
    [
      'chun', 'mian', 'bu', 'jue', 'xiao',
      'chu', 'chu', 'wen', 'ti', 'niao',
      'ye', 'lai', 'feng', 'yu', 'sheng',
      'hua', 'luo', 'zhi', 'duo', 'shao',
    ],
  ),
  makePassage(
    '登鹳雀楼 · 王之涣',
    '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。',
    [
      'bai', 'ri', 'yi', 'shan', 'jin',
      'huang', 'he', 'ru', 'hai', 'liu',
      'yu', 'qiong', 'qian', 'li', 'mu',
      'geng', 'shang', 'yi', 'ceng', 'lou',
    ],
  ),
  makePassage(
    '悯农 · 李绅',
    '锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。',
    [
      'chu', 'he', 'ri', 'dang', 'wu',
      'han', 'di', 'he', 'xia', 'tu',
      'shui', 'zhi', 'pan', 'zhong', 'can',
      'li', 'li', 'jie', 'xin', 'ku',
    ],
  ),
  makePassage(
    '江雪 · 柳宗元',
    '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。',
    [
      'qian', 'shan', 'niao', 'fei', 'jue',
      'wan', 'jing', 'ren', 'zong', 'mie',
      'gu', 'zhou', 'suo', 'li', 'weng',
      'du', 'diao', 'han', 'jiang', 'xue',
    ],
  ),
  makePassage(
    '相思 · 王维',
    '红豆生南国，春来发几枝。愿君多采撷，此物最相思。',
    [
      'hong', 'dou', 'sheng', 'nan', 'guo',
      'chun', 'lai', 'fa', 'ji', 'zhi',
      'yuan', 'jun', 'duo', 'cai', 'xie',
      'ci', 'wu', 'zui', 'xiang', 'si',
    ],
  ),
  makePassage(
    '咏鹅 · 骆宾王',
    '鹅鹅鹅，曲项向天歌。白毛浮绿水，红掌拨清波。',
    [
      'e', 'e', 'e',
      'qu', 'xiang', 'xiang', 'tian', 'ge',
      'bai', 'mao', 'fu', 'lü', 'shui',
      'hong', 'zhang', 'bo', 'qing', 'bo',
    ],
  ),
  makePassage(
    '寻隐者不遇 · 贾岛',
    '松下问童子，言师采药去。只在此山中，云深不知处。',
    [
      'song', 'xia', 'wen', 'tong', 'zi',
      'yan', 'shi', 'cai', 'yao', 'qu',
      'zhi', 'zai', 'ci', 'shan', 'zhong',
      'yun', 'shen', 'bu', 'zhi', 'chu',
    ],
  ),
  makePassage(
    '绝句 · 杜甫',
    '两个黄鹂鸣翠柳，一行白鹭上青天。窗含西岭千秋雪，门泊东吴万里船。',
    [
      'liang', 'ge', 'huang', 'li', 'ming', 'cui', 'liu',
      'yi', 'hang', 'bai', 'lu', 'shang', 'qing', 'tian',
      'chuang', 'han', 'xi', 'ling', 'qian', 'qiu', 'xue',
      'men', 'bo', 'dong', 'wu', 'wan', 'li', 'chuan',
    ],
  ),
  makePassage(
    '早发白帝城 · 李白',
    '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。',
    [
      'zhao', 'ci', 'bai', 'di', 'cai', 'yun', 'jian',
      'qian', 'li', 'jiang', 'ling', 'yi', 'ri', 'huan',
      'liang', 'an', 'yuan', 'sheng', 'ti', 'bu', 'zhu',
      'qing', 'zhou', 'yi', 'guo', 'wan', 'chong', 'shan',
    ],
  ),
  makePassage(
    '鸟鸣涧 · 王维',
    '人闲桂花落，夜静春山空。月出惊山鸟，时鸣春涧中。',
    [
      'ren', 'xian', 'gui', 'hua', 'luo',
      'ye', 'jing', 'chun', 'shan', 'kong',
      'yue', 'chu', 'jing', 'shan', 'niao',
      'shi', 'ming', 'chun', 'jian', 'zhong',
    ],
  ),
  makePassage(
    '赠汪伦 · 李白',
    '李白乘舟将欲行，忽闻岸上踏歌声。桃花潭水深千尺，不及汪伦送我情。',
    [
      'li', 'bai', 'cheng', 'zhou', 'jiang', 'yu', 'xing',
      'hu', 'wen', 'an', 'shang', 'ta', 'ge', 'sheng',
      'tao', 'hua', 'tan', 'shui', 'shen', 'qian', 'chi',
      'bu', 'ji', 'wang', 'lun', 'song', 'wo', 'qing',
    ],
  ),
]

/** Build typed units from text + parallel pinyin array (null = punctuation). */
export function buildUnits(text, pinyinList) {
  const units = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const py = pinyinList[i]
    if (isHanzi(ch) && py) {
      units.push({ char: ch, pinyin: py, index: i })
    }
  }
  return units
}
