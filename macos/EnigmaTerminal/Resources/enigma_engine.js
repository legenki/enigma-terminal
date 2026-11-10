// Bundled Enigma Crypto Engine for JavaScriptCore
var globalThis = this;
if (typeof TextEncoder === 'undefined') {
  globalThis.TextEncoder = class TextEncoder {
    encode(str) {
      const buf = [];
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 0x80) {
          buf.push(code);
        } else if (code < 0x800) {
          buf.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code < 0xd800 || code >= 0xe000) {
          buf.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        } else {
          i++;
          code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
          buf.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
      }
      return new Uint8Array(buf);
    }
  };
}
if (typeof TextDecoder === 'undefined') {
  globalThis.TextDecoder = class TextDecoder {
    decode(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i]);
      }
      return decodeURIComponent(escape(s));
    }
  };
}

// --- docs/js/wordlist.js ---
// GENERATED FILE — edit data/english.txt and run tools/build_web_data.py instead.
const WORDLIST_SHA256 = '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda';
const WORDLIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
  'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
  'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
  'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
  'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
  'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
  'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
  'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
  'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact',
  'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
  'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
  'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado',
  'avoid', 'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis',
  'baby', 'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball',
  'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base',
  'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
  'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt',
  'bench', 'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle',
  'bid', 'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black',
  'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood',
  'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring',
  'borrow', 'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain',
  'brand', 'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief',
  'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother',
  'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
  'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus',
  'business', 'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable',
  'cactus', 'cage', 'cake', 'call', 'calm', 'camera', 'camp', 'can',
  'canal', 'cancel', 'candy', 'cannon', 'canoe', 'canvas', 'canyon', 'capable',
  'capital', 'captain', 'car', 'carbon', 'card', 'cargo', 'carpet', 'carry',
  'cart', 'case', 'cash', 'casino', 'castle', 'casual', 'cat', 'catalog',
  'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave', 'ceiling',
  'celery', 'cement', 'census', 'century', 'cereal', 'certain', 'chair', 'chalk',
  'champion', 'change', 'chaos', 'chapter', 'charge', 'chase', 'chat', 'cheap',
  'check', 'cheese', 'chef', 'cherry', 'chest', 'chicken', 'chief', 'child',
  'chimney', 'choice', 'choose', 'chronic', 'chuckle', 'chunk', 'churn', 'cigar',
  'cinnamon', 'circle', 'citizen', 'city', 'civil', 'claim', 'clap', 'clarify',
  'claw', 'clay', 'clean', 'clerk', 'clever', 'click', 'client', 'cliff',
  'climb', 'clinic', 'clip', 'clock', 'clog', 'close', 'cloth', 'cloud',
  'clown', 'club', 'clump', 'cluster', 'clutch', 'coach', 'coast', 'coconut',
  'code', 'coffee', 'coil', 'coin', 'collect', 'color', 'column', 'combine',
  'come', 'comfort', 'comic', 'common', 'company', 'concert', 'conduct', 'confirm',
  'congress', 'connect', 'consider', 'control', 'convince', 'cook', 'cool', 'copper',
  'copy', 'coral', 'core', 'corn', 'correct', 'cost', 'cotton', 'couch',
  'country', 'couple', 'course', 'cousin', 'cover', 'coyote', 'crack', 'cradle',
  'craft', 'cram', 'crane', 'crash', 'crater', 'crawl', 'crazy', 'cream',
  'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp', 'critic', 'crop',
  'cross', 'crouch', 'crowd', 'crucial', 'cruel', 'cruise', 'crumble', 'crunch',
  'crush', 'cry', 'crystal', 'cube', 'culture', 'cup', 'cupboard', 'curious',
  'current', 'curtain', 'curve', 'cushion', 'custom', 'cute', 'cycle', 'dad',
  'damage', 'damp', 'dance', 'danger', 'daring', 'dash', 'daughter', 'dawn',
  'day', 'deal', 'debate', 'debris', 'decade', 'december', 'decide', 'decline',
  'decorate', 'decrease', 'deer', 'defense', 'define', 'defy', 'degree', 'delay',
  'deliver', 'demand', 'demise', 'denial', 'dentist', 'deny', 'depart', 'depend',
  'deposit', 'depth', 'deputy', 'derive', 'describe', 'desert', 'design', 'desk',
  'despair', 'destroy', 'detail', 'detect', 'develop', 'device', 'devote', 'diagram',
  'dial', 'diamond', 'diary', 'dice', 'diesel', 'diet', 'differ', 'digital',
  'dignity', 'dilemma', 'dinner', 'dinosaur', 'direct', 'dirt', 'disagree', 'discover',
  'disease', 'dish', 'dismiss', 'disorder', 'display', 'distance', 'divert', 'divide',
  'divorce', 'dizzy', 'doctor', 'document', 'dog', 'doll', 'dolphin', 'domain',
  'donate', 'donkey', 'donor', 'door', 'dose', 'double', 'dove', 'draft',
  'dragon', 'drama', 'drastic', 'draw', 'dream', 'dress', 'drift', 'drill',
  'drink', 'drip', 'drive', 'drop', 'drum', 'dry', 'duck', 'dumb',
  'dune', 'during', 'dust', 'dutch', 'duty', 'dwarf', 'dynamic', 'eager',
  'eagle', 'early', 'earn', 'earth', 'easily', 'east', 'easy', 'echo',
  'ecology', 'economy', 'edge', 'edit', 'educate', 'effort', 'egg', 'eight',
  'either', 'elbow', 'elder', 'electric', 'elegant', 'element', 'elephant', 'elevator',
  'elite', 'else', 'embark', 'embody', 'embrace', 'emerge', 'emotion', 'employ',
  'empower', 'empty', 'enable', 'enact', 'end', 'endless', 'endorse', 'enemy',
  'energy', 'enforce', 'engage', 'engine', 'enhance', 'enjoy', 'enlist', 'enough',
  'enrich', 'enroll', 'ensure', 'enter', 'entire', 'entry', 'envelope', 'episode',
  'equal', 'equip', 'era', 'erase', 'erode', 'erosion', 'error', 'erupt',
  'escape', 'essay', 'essence', 'estate', 'eternal', 'ethics', 'evidence', 'evil',
  'evoke', 'evolve', 'exact', 'example', 'excess', 'exchange', 'excite', 'exclude',
  'excuse', 'execute', 'exercise', 'exhaust', 'exhibit', 'exile', 'exist', 'exit',
  'exotic', 'expand', 'expect', 'expire', 'explain', 'expose', 'express', 'extend',
  'extra', 'eye', 'eyebrow', 'fabric', 'face', 'faculty', 'fade', 'faint',
  'faith', 'fall', 'false', 'fame', 'family', 'famous', 'fan', 'fancy',
  'fantasy', 'farm', 'fashion', 'fat', 'fatal', 'father', 'fatigue', 'fault',
  'favorite', 'feature', 'february', 'federal', 'fee', 'feed', 'feel', 'female',
  'fence', 'festival', 'fetch', 'fever', 'few', 'fiber', 'fiction', 'field',
  'figure', 'file', 'film', 'filter', 'final', 'find', 'fine', 'finger',
  'finish', 'fire', 'firm', 'first', 'fiscal', 'fish', 'fit', 'fitness',
  'fix', 'flag', 'flame', 'flash', 'flat', 'flavor', 'flee', 'flight',
  'flip', 'float', 'flock', 'floor', 'flower', 'fluid', 'flush', 'fly',
  'foam', 'focus', 'fog', 'foil', 'fold', 'follow', 'food', 'foot',
  'force', 'forest', 'forget', 'fork', 'fortune', 'forum', 'forward', 'fossil',
  'foster', 'found', 'fox', 'fragile', 'frame', 'frequent', 'fresh', 'friend',
  'fringe', 'frog', 'front', 'frost', 'frown', 'frozen', 'fruit', 'fuel',
  'fun', 'funny', 'furnace', 'fury', 'future', 'gadget', 'gain', 'galaxy',
  'gallery', 'game', 'gap', 'garage', 'garbage', 'garden', 'garlic', 'garment',
  'gas', 'gasp', 'gate', 'gather', 'gauge', 'gaze', 'general', 'genius',
  'genre', 'gentle', 'genuine', 'gesture', 'ghost', 'giant', 'gift', 'giggle',
  'ginger', 'giraffe', 'girl', 'give', 'glad', 'glance', 'glare', 'glass',
  'glide', 'glimpse', 'globe', 'gloom', 'glory', 'glove', 'glow', 'glue',
  'goat', 'goddess', 'gold', 'good', 'goose', 'gorilla', 'gospel', 'gossip',
  'govern', 'gown', 'grab', 'grace', 'grain', 'grant', 'grape', 'grass',
  'gravity', 'great', 'green', 'grid', 'grief', 'grit', 'grocery', 'group',
  'grow', 'grunt', 'guard', 'guess', 'guide', 'guilt', 'guitar', 'gun',
  'gym', 'habit', 'hair', 'half', 'hammer', 'hamster', 'hand', 'happy',
  'harbor', 'hard', 'harsh', 'harvest', 'hat', 'have', 'hawk', 'hazard',
  'head', 'health', 'heart', 'heavy', 'hedgehog', 'height', 'hello', 'helmet',
  'help', 'hen', 'hero', 'hidden', 'high', 'hill', 'hint', 'hip',
  'hire', 'history', 'hobby', 'hockey', 'hold', 'hole', 'holiday', 'hollow',
  'home', 'honey', 'hood', 'hope', 'horn', 'horror', 'horse', 'hospital',
  'host', 'hotel', 'hour', 'hover', 'hub', 'huge', 'human', 'humble',
  'humor', 'hundred', 'hungry', 'hunt', 'hurdle', 'hurry', 'hurt', 'husband',
  'hybrid', 'ice', 'icon', 'idea', 'identify', 'idle', 'ignore', 'ill',
  'illegal', 'illness', 'image', 'imitate', 'immense', 'immune', 'impact', 'impose',
  'improve', 'impulse', 'inch', 'include', 'income', 'increase', 'index', 'indicate',
  'indoor', 'industry', 'infant', 'inflict', 'inform', 'inhale', 'inherit', 'initial',
  'inject', 'injury', 'inmate', 'inner', 'innocent', 'input', 'inquiry', 'insane',
  'insect', 'inside', 'inspire', 'install', 'intact', 'interest', 'into', 'invest',
  'invite', 'involve', 'iron', 'island', 'isolate', 'issue', 'item', 'ivory',
  'jacket', 'jaguar', 'jar', 'jazz', 'jealous', 'jeans', 'jelly', 'jewel',
  'job', 'join', 'joke', 'journey', 'joy', 'judge', 'juice', 'jump',
  'jungle', 'junior', 'junk', 'just', 'kangaroo', 'keen', 'keep', 'ketchup',
  'key', 'kick', 'kid', 'kidney', 'kind', 'kingdom', 'kiss', 'kit',
  'kitchen', 'kite', 'kitten', 'kiwi', 'knee', 'knife', 'knock', 'know',
  'lab', 'label', 'labor', 'ladder', 'lady', 'lake', 'lamp', 'language',
  'laptop', 'large', 'later', 'latin', 'laugh', 'laundry', 'lava', 'law',
  'lawn', 'lawsuit', 'layer', 'lazy', 'leader', 'leaf', 'learn', 'leave',
  'lecture', 'left', 'leg', 'legal', 'legend', 'leisure', 'lemon', 'lend',
  'length', 'lens', 'leopard', 'lesson', 'letter', 'level', 'liar', 'liberty',
  'library', 'license', 'life', 'lift', 'light', 'like', 'limb', 'limit',
  'link', 'lion', 'liquid', 'list', 'little', 'live', 'lizard', 'load',
  'loan', 'lobster', 'local', 'lock', 'logic', 'lonely', 'long', 'loop',
  'lottery', 'loud', 'lounge', 'love', 'loyal', 'lucky', 'luggage', 'lumber',
  'lunar', 'lunch', 'luxury', 'lyrics', 'machine', 'mad', 'magic', 'magnet',
  'maid', 'mail', 'main', 'major', 'make', 'mammal', 'man', 'manage',
  'mandate', 'mango', 'mansion', 'manual', 'maple', 'marble', 'march', 'margin',
  'marine', 'market', 'marriage', 'mask', 'mass', 'master', 'match', 'material',
  'math', 'matrix', 'matter', 'maximum', 'maze', 'meadow', 'mean', 'measure',
  'meat', 'mechanic', 'medal', 'media', 'melody', 'melt', 'member', 'memory',
  'mention', 'menu', 'mercy', 'merge', 'merit', 'merry', 'mesh', 'message',
  'metal', 'method', 'middle', 'midnight', 'milk', 'million', 'mimic', 'mind',
  'minimum', 'minor', 'minute', 'miracle', 'mirror', 'misery', 'miss', 'mistake',
  'mix', 'mixed', 'mixture', 'mobile', 'model', 'modify', 'mom', 'moment',
  'monitor', 'monkey', 'monster', 'month', 'moon', 'moral', 'more', 'morning',
  'mosquito', 'mother', 'motion', 'motor', 'mountain', 'mouse', 'move', 'movie',
  'much', 'muffin', 'mule', 'multiply', 'muscle', 'museum', 'mushroom', 'music',
  'must', 'mutual', 'myself', 'mystery', 'myth', 'naive', 'name', 'napkin',
  'narrow', 'nasty', 'nation', 'nature', 'near', 'neck', 'need', 'negative',
  'neglect', 'neither', 'nephew', 'nerve', 'nest', 'net', 'network', 'neutral',
  'never', 'news', 'next', 'nice', 'night', 'noble', 'noise', 'nominee',
  'noodle', 'normal', 'north', 'nose', 'notable', 'note', 'nothing', 'notice',
  'novel', 'now', 'nuclear', 'number', 'nurse', 'nut', 'oak', 'obey',
  'object', 'oblige', 'obscure', 'observe', 'obtain', 'obvious', 'occur', 'ocean',
  'october', 'odor', 'off', 'offer', 'office', 'often', 'oil', 'okay',
  'old', 'olive', 'olympic', 'omit', 'once', 'one', 'onion', 'online',
  'only', 'open', 'opera', 'opinion', 'oppose', 'option', 'orange', 'orbit',
  'orchard', 'order', 'ordinary', 'organ', 'orient', 'original', 'orphan', 'ostrich',
  'other', 'outdoor', 'outer', 'output', 'outside', 'oval', 'oven', 'over',
  'own', 'owner', 'oxygen', 'oyster', 'ozone', 'pact', 'paddle', 'page',
  'pair', 'palace', 'palm', 'panda', 'panel', 'panic', 'panther', 'paper',
  'parade', 'parent', 'park', 'parrot', 'party', 'pass', 'patch', 'path',
  'patient', 'patrol', 'pattern', 'pause', 'pave', 'payment', 'peace', 'peanut',
  'pear', 'peasant', 'pelican', 'pen', 'penalty', 'pencil', 'people', 'pepper',
  'perfect', 'permit', 'person', 'pet', 'phone', 'photo', 'phrase', 'physical',
  'piano', 'picnic', 'picture', 'piece', 'pig', 'pigeon', 'pill', 'pilot',
  'pink', 'pioneer', 'pipe', 'pistol', 'pitch', 'pizza', 'place', 'planet',
  'plastic', 'plate', 'play', 'please', 'pledge', 'pluck', 'plug', 'plunge',
  'poem', 'poet', 'point', 'polar', 'pole', 'police', 'pond', 'pony',
  'pool', 'popular', 'portion', 'position', 'possible', 'post', 'potato', 'pottery',
  'poverty', 'powder', 'power', 'practice', 'praise', 'predict', 'prefer', 'prepare',
  'present', 'pretty', 'prevent', 'price', 'pride', 'primary', 'print', 'priority',
  'prison', 'private', 'prize', 'problem', 'process', 'produce', 'profit', 'program',
  'project', 'promote', 'proof', 'property', 'prosper', 'protect', 'proud', 'provide',
  'public', 'pudding', 'pull', 'pulp', 'pulse', 'pumpkin', 'punch', 'pupil',
  'puppy', 'purchase', 'purity', 'purpose', 'purse', 'push', 'put', 'puzzle',
  'pyramid', 'quality', 'quantum', 'quarter', 'question', 'quick', 'quit', 'quiz',
  'quote', 'rabbit', 'raccoon', 'race', 'rack', 'radar', 'radio', 'rail',
  'rain', 'raise', 'rally', 'ramp', 'ranch', 'random', 'range', 'rapid',
  'rare', 'rate', 'rather', 'raven', 'raw', 'razor', 'ready', 'real',
  'reason', 'rebel', 'rebuild', 'recall', 'receive', 'recipe', 'record', 'recycle',
  'reduce', 'reflect', 'reform', 'refuse', 'region', 'regret', 'regular', 'reject',
  'relax', 'release', 'relief', 'rely', 'remain', 'remember', 'remind', 'remove',
  'render', 'renew', 'rent', 'reopen', 'repair', 'repeat', 'replace', 'report',
  'require', 'rescue', 'resemble', 'resist', 'resource', 'response', 'result', 'retire',
  'retreat', 'return', 'reunion', 'reveal', 'review', 'reward', 'rhythm', 'rib',
  'ribbon', 'rice', 'rich', 'ride', 'ridge', 'rifle', 'right', 'rigid',
  'ring', 'riot', 'ripple', 'risk', 'ritual', 'rival', 'river', 'road',
  'roast', 'robot', 'robust', 'rocket', 'romance', 'roof', 'rookie', 'room',
  'rose', 'rotate', 'rough', 'round', 'route', 'royal', 'rubber', 'rude',
  'rug', 'rule', 'run', 'runway', 'rural', 'sad', 'saddle', 'sadness',
  'safe', 'sail', 'salad', 'salmon', 'salon', 'salt', 'salute', 'same',
  'sample', 'sand', 'satisfy', 'satoshi', 'sauce', 'sausage', 'save', 'say',
  'scale', 'scan', 'scare', 'scatter', 'scene', 'scheme', 'school', 'science',
  'scissors', 'scorpion', 'scout', 'scrap', 'screen', 'script', 'scrub', 'sea',
  'search', 'season', 'seat', 'second', 'secret', 'section', 'security', 'seed',
  'seek', 'segment', 'select', 'sell', 'seminar', 'senior', 'sense', 'sentence',
  'series', 'service', 'session', 'settle', 'setup', 'seven', 'shadow', 'shaft',
  'shallow', 'share', 'shed', 'shell', 'sheriff', 'shield', 'shift', 'shine',
  'ship', 'shiver', 'shock', 'shoe', 'shoot', 'shop', 'short', 'shoulder',
  'shove', 'shrimp', 'shrug', 'shuffle', 'shy', 'sibling', 'sick', 'side',
  'siege', 'sight', 'sign', 'silent', 'silk', 'silly', 'silver', 'similar',
  'simple', 'since', 'sing', 'siren', 'sister', 'situate', 'six', 'size',
  'skate', 'sketch', 'ski', 'skill', 'skin', 'skirt', 'skull', 'slab',
  'slam', 'sleep', 'slender', 'slice', 'slide', 'slight', 'slim', 'slogan',
  'slot', 'slow', 'slush', 'small', 'smart', 'smile', 'smoke', 'smooth',
  'snack', 'snake', 'snap', 'sniff', 'snow', 'soap', 'soccer', 'social',
  'sock', 'soda', 'soft', 'solar', 'soldier', 'solid', 'solution', 'solve',
  'someone', 'song', 'soon', 'sorry', 'sort', 'soul', 'sound', 'soup',
  'source', 'south', 'space', 'spare', 'spatial', 'spawn', 'speak', 'special',
  'speed', 'spell', 'spend', 'sphere', 'spice', 'spider', 'spike', 'spin',
  'spirit', 'split', 'spoil', 'sponsor', 'spoon', 'sport', 'spot', 'spray',
  'spread', 'spring', 'spy', 'square', 'squeeze', 'squirrel', 'stable', 'stadium',
  'staff', 'stage', 'stairs', 'stamp', 'stand', 'start', 'state', 'stay',
  'steak', 'steel', 'stem', 'step', 'stereo', 'stick', 'still', 'sting',
  'stock', 'stomach', 'stone', 'stool', 'story', 'stove', 'strategy', 'street',
  'strike', 'strong', 'struggle', 'student', 'stuff', 'stumble', 'style', 'subject',
  'submit', 'subway', 'success', 'such', 'sudden', 'suffer', 'sugar', 'suggest',
  'suit', 'summer', 'sun', 'sunny', 'sunset', 'super', 'supply', 'supreme',
  'sure', 'surface', 'surge', 'surprise', 'surround', 'survey', 'suspect', 'sustain',
  'swallow', 'swamp', 'swap', 'swarm', 'swear', 'sweet', 'swift', 'swim',
  'swing', 'switch', 'sword', 'symbol', 'symptom', 'syrup', 'system', 'table',
  'tackle', 'tag', 'tail', 'talent', 'talk', 'tank', 'tape', 'target',
  'task', 'taste', 'tattoo', 'taxi', 'teach', 'team', 'tell', 'ten',
  'tenant', 'tennis', 'tent', 'term', 'test', 'text', 'thank', 'that',
  'theme', 'then', 'theory', 'there', 'they', 'thing', 'this', 'thought',
  'three', 'thrive', 'throw', 'thumb', 'thunder', 'ticket', 'tide', 'tiger',
  'tilt', 'timber', 'time', 'tiny', 'tip', 'tired', 'tissue', 'title',
  'toast', 'tobacco', 'today', 'toddler', 'toe', 'together', 'toilet', 'token',
  'tomato', 'tomorrow', 'tone', 'tongue', 'tonight', 'tool', 'tooth', 'top',
  'topic', 'topple', 'torch', 'tornado', 'tortoise', 'toss', 'total', 'tourist',
  'toward', 'tower', 'town', 'toy', 'track', 'trade', 'traffic', 'tragic',
  'train', 'transfer', 'trap', 'trash', 'travel', 'tray', 'treat', 'tree',
  'trend', 'trial', 'tribe', 'trick', 'trigger', 'trim', 'trip', 'trophy',
  'trouble', 'truck', 'true', 'truly', 'trumpet', 'trust', 'truth', 'try',
  'tube', 'tuition', 'tumble', 'tuna', 'tunnel', 'turkey', 'turn', 'turtle',
  'twelve', 'twenty', 'twice', 'twin', 'twist', 'two', 'type', 'typical',
  'ugly', 'umbrella', 'unable', 'unaware', 'uncle', 'uncover', 'under', 'undo',
  'unfair', 'unfold', 'unhappy', 'uniform', 'unique', 'unit', 'universe', 'unknown',
  'unlock', 'until', 'unusual', 'unveil', 'update', 'upgrade', 'uphold', 'upon',
  'upper', 'upset', 'urban', 'urge', 'usage', 'use', 'used', 'useful',
  'useless', 'usual', 'utility', 'vacant', 'vacuum', 'vague', 'valid', 'valley',
  'valve', 'van', 'vanish', 'vapor', 'various', 'vast', 'vault', 'vehicle',
  'velvet', 'vendor', 'venture', 'venue', 'verb', 'verify', 'version', 'very',
  'vessel', 'veteran', 'viable', 'vibrant', 'vicious', 'victory', 'video', 'view',
  'village', 'vintage', 'violin', 'virtual', 'virus', 'visa', 'visit', 'visual',
  'vital', 'vivid', 'vocal', 'voice', 'void', 'volcano', 'volume', 'vote',
  'voyage', 'wage', 'wagon', 'wait', 'walk', 'wall', 'walnut', 'want',
  'warfare', 'warm', 'warrior', 'wash', 'wasp', 'waste', 'water', 'wave',
  'way', 'wealth', 'weapon', 'wear', 'weasel', 'weather', 'web', 'wedding',
  'weekend', 'weird', 'welcome', 'west', 'wet', 'whale', 'what', 'wheat',
  'wheel', 'when', 'where', 'whip', 'whisper', 'wide', 'width', 'wife',
  'wild', 'will', 'win', 'window', 'wine', 'wing', 'wink', 'winner',
  'winter', 'wire', 'wisdom', 'wise', 'wish', 'witness', 'wolf', 'woman',
  'wonder', 'wood', 'wool', 'word', 'work', 'world', 'worry', 'worth',
  'wrap', 'wreck', 'wrestle', 'wrist', 'write', 'wrong', 'yard', 'year',
  'yellow', 'you', 'young', 'youth', 'zebra', 'zero', 'zone', 'zoo',
];


// --- docs/js/crypto/hash.js ---
// Hashing primitives for the browser build: SHA-256, SHA-512, HMAC, PBKDF2 and
// RIPEMD-160. Written by hand rather than on top of WebCrypto so the terminal
// stays synchronous and still runs from file:// where crypto.subtle is absent.

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
function sha256(message) {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLength = message.length * 8;
  const padded = new Uint8Array((((message.length + 8) >> 6) + 1) * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 =
        ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  new DataView(out.buffer).setUint32(0, h[0]);
  for (let i = 0; i < 8; i++) new DataView(out.buffer).setUint32(i * 4, h[i]);
  return out;
}

// --- SHA-512 ---------------------------------------------------------------
// 64-bit words are carried as (hi, lo) pairs of 32-bit ints.

const K512 = [
  '428a2f98d728ae22',
  '7137449123ef65cd',
  'b5c0fbcfec4d3b2f',
  'e9b5dba58189dbbc',
  '3956c25bf348b538',
  '59f111f1b605d019',
  '923f82a4af194f9b',
  'ab1c5ed5da6d8118',
  'd807aa98a3030242',
  '12835b0145706fbe',
  '243185be4ee4b28c',
  '550c7dc3d5ffb4e2',
  '72be5d74f27b896f',
  '80deb1fe3b1696b1',
  '9bdc06a725c71235',
  'c19bf174cf692694',
  'e49b69c19ef14ad2',
  'efbe4786384f25e3',
  '0fc19dc68b8cd5b5',
  '240ca1cc77ac9c65',
  '2de92c6f592b0275',
  '4a7484aa6ea6e483',
  '5cb0a9dcbd41fbd4',
  '76f988da831153b5',
  '983e5152ee66dfab',
  'a831c66d2db43210',
  'b00327c898fb213f',
  'bf597fc7beef0ee4',
  'c6e00bf33da88fc2',
  'd5a79147930aa725',
  '06ca6351e003826f',
  '142929670a0e6e70',
  '27b70a8546d22ffc',
  '2e1b21385c26c926',
  '4d2c6dfc5ac42aed',
  '53380d139d95b3df',
  '650a73548baf63de',
  '766a0abb3c77b2a8',
  '81c2c92e47edaee6',
  '92722c851482353b',
  'a2bfe8a14cf10364',
  'a81a664bbc423001',
  'c24b8b70d0f89791',
  'c76c51a30654be30',
  'd192e819d6ef5218',
  'd69906245565a910',
  'f40e35855771202a',
  '106aa07032bbd1b8',
  '19a4c116b8d2d0c8',
  '1e376c085141ab53',
  '2748774cdf8eeb99',
  '34b0bcb5e19b48a8',
  '391c0cb3c5c95a63',
  '4ed8aa4ae3418acb',
  '5b9cca4f7763e373',
  '682e6ff3d6b2b8a3',
  '748f82ee5defb2fc',
  '78a5636f43172f60',
  '84c87814a1f0ab72',
  '8cc702081a6439ec',
  '90befffa23631e28',
  'a4506cebde82bde9',
  'bef9a3f7b2c67915',
  'c67178f2e372532b',
  'ca273eceea26619c',
  'd186b8c721c0c207',
  'eada7dd6cde0eb1e',
  'f57d4f7fee6ed178',
  '06f067aa72176fba',
  '0a637dc5a2c898a6',
  '113f9804bef90dae',
  '1b710b35131c471b',
  '28db77f523047d84',
  '32caab7b40c72493',
  '3c9ebe0a15c9bebc',
  '431d67c49c100d4c',
  '4cc5d4becb3e42b6',
  '597f299cfc657e2a',
  '5fcb6fab3ad6faec',
  '6c44198c4a475817',
].map((hex) => [
  parseInt(hex.slice(0, 8), 16) | 0,
  parseInt(hex.slice(8), 16) | 0,
]);

const IV512 = [
  '6a09e667f3bcc908',
  'bb67ae8584caa73b',
  '3c6ef372fe94f82b',
  'a54ff53a5f1d36f1',
  '510e527fade682d1',
  '9b05688c2b3e6c1f',
  '1f83d9abfb41bd6b',
  '5be0cd19137e2179',
].map((hex) => [
  parseInt(hex.slice(0, 8), 16) | 0,
  parseInt(hex.slice(8), 16) | 0,
]);
function sha512(message) {
  const hh = new Int32Array(16);
  for (let i = 0; i < 8; i++) {
    hh[i * 2] = IV512[i][0];
    hh[i * 2 + 1] = IV512[i][1];
  }

  const blocks = (((message.length + 16) >> 7) + 1) * 128;
  const padded = new Uint8Array(blocks);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = message.length * 8;
  view.setUint32(blocks - 8, Math.floor(bits / 0x100000000));
  view.setUint32(blocks - 4, bits >>> 0);

  const wh = new Int32Array(80);
  const wl = new Int32Array(80);

  for (let offset = 0; offset < blocks; offset += 128) {
    for (let i = 0; i < 16; i++) {
      wh[i] = view.getInt32(offset + i * 8);
      wl[i] = view.getInt32(offset + i * 8 + 4);
    }
    for (let i = 16; i < 80; i++) {
      let xh = wh[i - 15],
        xl = wl[i - 15];
      const s0h =
        (((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7)) |
        0;
      const s0l =
        (((xl >>> 1) | (xh << 31)) ^
          ((xl >>> 8) | (xh << 24)) ^
          ((xl >>> 7) | (xh << 25))) |
        0;
      xh = wh[i - 2];
      xl = wl[i - 2];
      const s1h =
        (((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6)) |
        0;
      const s1l =
        (((xl >>> 19) | (xh << 13)) ^
          ((xh >>> 29) | (xl << 3)) ^
          ((xl >>> 6) | (xh << 26))) |
        0;

      let lo = (wl[i - 16] >>> 0) + (s0l >>> 0);
      let hi = (wh[i - 16] + s0h + ((lo / 0x100000000) | 0)) | 0;
      lo = (lo >>> 0) + (wl[i - 7] >>> 0);
      hi = (hi + wh[i - 7] + ((lo / 0x100000000) | 0)) | 0;
      lo = (lo >>> 0) + (s1l >>> 0);
      hi = (hi + s1h + ((lo / 0x100000000) | 0)) | 0;
      wh[i] = hi | 0;
      wl[i] = lo | 0;
    }

    let ah = hh[0],
      al = hh[1],
      bh = hh[2],
      bl = hh[3],
      ch = hh[4],
      cl = hh[5];
    let dh = hh[6],
      dl = hh[7],
      eh = hh[8],
      el = hh[9],
      fh = hh[10],
      fl = hh[11];
    let gh = hh[12],
      gl = hh[13],
      hih = hh[14],
      hil = hh[15];

    for (let i = 0; i < 80; i++) {
      const S1h =
        (((eh >>> 14) | (el << 18)) ^
          ((eh >>> 18) | (el << 14)) ^
          ((el >>> 9) | (eh << 23))) |
        0;
      const S1l =
        (((el >>> 14) | (eh << 18)) ^
          ((el >>> 18) | (eh << 14)) ^
          ((eh >>> 9) | (el << 23))) |
        0;
      const chh = ((eh & fh) ^ (~eh & gh)) | 0;
      const chl = ((el & fl) ^ (~el & gl)) | 0;
      const S0h =
        (((ah >>> 28) | (al << 4)) ^
          ((al >>> 2) | (ah << 30)) ^
          ((al >>> 7) | (ah << 25))) |
        0;
      const S0l =
        (((al >>> 28) | (ah << 4)) ^
          ((ah >>> 2) | (al << 30)) ^
          ((ah >>> 7) | (al << 25))) |
        0;
      const majh = ((ah & bh) ^ (ah & ch) ^ (bh & ch)) | 0;
      const majl = ((al & bl) ^ (al & cl) ^ (bl & cl)) | 0;

      let t1l = (hil >>> 0) + (S1l >>> 0);
      let t1h = (hih + S1h + ((t1l / 0x100000000) | 0)) | 0;
      t1l = (t1l >>> 0) + (chl >>> 0);
      t1h = (t1h + chh + ((t1l / 0x100000000) | 0)) | 0;
      t1l = (t1l >>> 0) + (K512[i][1] >>> 0);
      t1h = (t1h + K512[i][0] + ((t1l / 0x100000000) | 0)) | 0;
      t1l = (t1l >>> 0) + (wl[i] >>> 0);
      t1h = (t1h + wh[i] + ((t1l / 0x100000000) | 0)) | 0;

      const t2l = (S0l >>> 0) + (majl >>> 0);
      const t2h = (S0h + majh + ((t2l / 0x100000000) | 0)) | 0;

      hih = gh;
      hil = gl;
      gh = fh;
      gl = fl;
      fh = eh;
      fl = el;
      let lo = (dl >>> 0) + (t1l >>> 0);
      eh = (dh + t1h + ((lo / 0x100000000) | 0)) | 0;
      el = lo | 0;
      dh = ch;
      dl = cl;
      ch = bh;
      cl = bl;
      bh = ah;
      bl = al;
      lo = (t1l >>> 0) + (t2l >>> 0);
      ah = (t1h + t2h + ((lo / 0x100000000) | 0)) | 0;
      al = lo | 0;
    }

    const add = (index, addHi, addLo) => {
      const lo = (hh[index + 1] >>> 0) + (addLo >>> 0);
      hh[index] = (hh[index] + addHi + ((lo / 0x100000000) | 0)) | 0;
      hh[index + 1] = lo | 0;
    };
    add(0, ah, al);
    add(2, bh, bl);
    add(4, ch, cl);
    add(6, dh, dl);
    add(8, eh, el);
    add(10, fh, fl);
    add(12, gh, gl);
    add(14, hih, hil);
  }

  const out = new Uint8Array(64);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 16; i++) outView.setInt32(i * 4, hh[i]);
  return out;
}

// --- HMAC / PBKDF2 ---------------------------------------------------------

function hmac(hashFn, blockSize, key, message) {
  let k = key;
  if (k.length > blockSize) k = hashFn(k);
  const pad = new Uint8Array(blockSize);
  pad.set(k);
  const inner = new Uint8Array(blockSize + message.length);
  const outerKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    inner[i] = pad[i] ^ 0x36;
    outerKey[i] = pad[i] ^ 0x5c;
  }
  inner.set(message, blockSize);
  const innerHash = hashFn(inner);
  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(outerKey);
  outer.set(innerHash, blockSize);
  return hashFn(outer);
}
const hmacSha512 = (key, message) => hmac(sha512, 128, key, message);
const hmacSha256 = (key, message) => hmac(sha256, 64, key, message);

/** PBKDF2-HMAC-SHA512 — exactly what BIP-39 uses to stretch a mnemonic into a seed. */
function pbkdf2Sha512(password, salt, iterations, keyLength) {
  const out = new Uint8Array(keyLength);
  const blocks = Math.ceil(keyLength / 64);
  for (let block = 1; block <= blocks; block++) {
    const input = new Uint8Array(salt.length + 4);
    input.set(salt);
    new DataView(input.buffer).setUint32(salt.length, block);
    let u = hmacSha512(password, input);
    const acc = u.slice();
    for (let round = 1; round < iterations; round++) {
      u = hmacSha512(password, u);
      for (let i = 0; i < 64; i++) acc[i] ^= u[i];
    }
    out.set(
      acc.subarray(0, Math.min(64, keyLength - (block - 1) * 64)),
      (block - 1) * 64,
    );
  }
  return out;
}

// --- RIPEMD-160 ------------------------------------------------------------

const RL = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8],
  [3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12],
  [1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2],
  [4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13],
];
const RR = [
  [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12],
  [6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2],
  [15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13],
  [8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14],
  [12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11],
];
const SL = [
  [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8],
  [7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12],
  [11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5],
  [11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12],
  [9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6],
];
const SR = [
  [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6],
  [9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11],
  [9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5],
  [15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8],
  [8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11],
];
const KL = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
const KR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

const rmdF = (j, x, y, z) => {
  if (j < 16) return x ^ y ^ z;
  if (j < 32) return (x & y) | (~x & z);
  if (j < 48) return (x | ~y) ^ z;
  if (j < 64) return (x & z) | (y & ~z);
  return x ^ (y | ~z);
};
const rol = (value, bits) => (value << bits) | (value >>> (32 - bits)) | 0;
function ripemd160(message) {
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  const blocks = (((message.length + 8) >> 6) + 1) * 64;
  const padded = new Uint8Array(blocks);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = message.length * 8;
  view.setUint32(blocks - 8, bits >>> 0, true);
  view.setUint32(blocks - 4, Math.floor(bits / 0x100000000), true);

  const x = new Int32Array(16);
  for (let offset = 0; offset < blocks; offset += 64) {
    for (let i = 0; i < 16; i++) x[i] = view.getInt32(offset + i * 4, true);
    let al = h0,
      bl = h1,
      cl = h2,
      dl = h3,
      el = h4;
    let ar = h0,
      br = h1,
      cr = h2,
      dr = h3,
      er = h4;
    for (let j = 0; j < 80; j++) {
      const round = (j / 16) | 0;
      let t = (al + rmdF(j, bl, cl, dl) + x[RL[round][j % 16]] + KL[round]) | 0;
      t = (rol(t, SL[round][j % 16]) + el) | 0;
      al = el;
      el = dl;
      dl = rol(cl, 10);
      cl = bl;
      bl = t;
      t =
        (ar + rmdF(79 - j, br, cr, dr) + x[RR[round][j % 16]] + KR[round]) | 0;
      t = (rol(t, SR[round][j % 16]) + er) | 0;
      ar = er;
      er = dr;
      dr = rol(cr, 10);
      cr = br;
      br = t;
    }
    const t = (h1 + cl + dr) | 0;
    h1 = (h2 + dl + er) | 0;
    h2 = (h3 + el + ar) | 0;
    h3 = (h4 + al + br) | 0;
    h4 = (h0 + bl + cr) | 0;
    h0 = t;
  }
  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((value, i) =>
    outView.setInt32(i * 4, value, true),
  );
  return out;
}

/** Bitcoin's HASH160: RIPEMD-160 over SHA-256. */
const hash160 = (data) => ripemd160(sha256(data));
/** Bitcoin's double SHA-256, used by Base58Check. */
const hash256 = (data) => sha256(sha256(data));
const toHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
function fromHex(hex) {
  const clean = hex.replace(/^0x/i, '').replace(/\s+/g, '');
  if (clean.length % 2) throw new Error('hex string must have an even length');
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('not hexadecimal');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
const utf8 = (text) => new TextEncoder().encode(text);


// --- docs/js/crypto/encoding.js ---
// Base58Check and Bech32/Bech32m — the two address alphabets Bitcoin uses.

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let out = '';
  while (value > 0n) {
    out = B58[Number(value % 58n)] + out;
    value /= 58n;
  }
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading++;
  return '1'.repeat(leading) + out;
}
function base58CheckEncode(payload) {
  const checksum = hash256(payload).subarray(0, 4);
  const full = new Uint8Array(payload.length + 4);
  full.set(payload);
  full.set(checksum, payload.length);
  return base58Encode(full);
}

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

const hrpExpand = (hrp) => [
  ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
  0,
  ...[...hrp].map((c) => c.charCodeAt(0) & 31),
];

function convertBits(data, from, to, pad = true) {
  let acc = 0;
  let bits = 0;
  const out = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits) out.push((acc << (to - bits)) & maxv);
  return out;
}

/** Segwit address encoder; witness v0 uses bech32, v1+ uses bech32m. */
function segwitAddress(hrp, witnessVersion, program) {
  const data = [witnessVersion, ...convertBits(Array.from(program), 8, 5)];
  const constant = witnessVersion === 0 ? 1 : 0x2bc830a3;
  const mod =
    polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ constant;
  const checksum = [];
  for (let i = 0; i < 6; i++) checksum.push((mod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...checksum].map((d) => CHARSET[d]).join('')}`;
}


// --- docs/js/crypto/secp256k1.js ---
// Minimal secp256k1: scalar multiplication in Jacobian coordinates, which keeps
// one modular inversion per public key instead of one per point operation.
const P =
  0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N =
  0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

const mod = (a, m = P) => ((a % m) + m) % m;

function inverse(a, m = P) {
  let [old_r, r] = [mod(a, m), m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error('value is not invertible');
  return mod(old_s, m);
}

// Jacobian point: {x, y, z} representing affine (x/z^2, y/z^3); z === 0n is infinity.
const jacobianDouble = (p) => {
  if (p.y === 0n || p.z === 0n) return { x: 0n, y: 0n, z: 0n };
  const ysq = mod(p.y * p.y);
  const s = mod(4n * p.x * ysq);
  const m = mod(3n * p.x * p.x);
  const nx = mod(m * m - 2n * s);
  const ny = mod(m * (s - nx) - 8n * ysq * ysq);
  const nz = mod(2n * p.y * p.z);
  return { x: nx, y: ny, z: nz };
};

const jacobianAdd = (p, q) => {
  if (p.z === 0n) return q;
  if (q.z === 0n) return p;
  const pz2 = mod(p.z * p.z);
  const qz2 = mod(q.z * q.z);
  const u1 = mod(p.x * qz2);
  const u2 = mod(q.x * pz2);
  const s1 = mod(p.y * qz2 * q.z);
  const s2 = mod(q.y * pz2 * p.z);
  if (u1 === u2) return s1 === s2 ? jacobianDouble(p) : { x: 0n, y: 0n, z: 0n };
  const h = mod(u2 - u1);
  const r = mod(s2 - s1);
  const h2 = mod(h * h);
  const h3 = mod(h * h2);
  const u1h2 = mod(u1 * h2);
  const nx = mod(r * r - h3 - 2n * u1h2);
  const ny = mod(r * (u1h2 - nx) - s1 * h3);
  const nz = mod(h * p.z * q.z);
  return { x: nx, y: ny, z: nz };
};

/** Multiply the generator (or a given affine point) by a scalar. */
function pointMultiply(scalar, base = { x: GX, y: GY }) {
  let result = { x: 0n, y: 0n, z: 0n };
  let addend = { x: base.x, y: base.y, z: 1n };
  let k = scalar;
  while (k > 0n) {
    if (k & 1n) result = jacobianAdd(result, addend);
    addend = jacobianDouble(addend);
    k >>= 1n;
  }
  if (result.z === 0n) throw new Error('point at infinity');
  const zInv = inverse(result.z);
  const zInv2 = mod(zInv * zInv);
  return { x: mod(result.x * zInv2), y: mod(result.y * zInv2 * zInv) };
}

const toBytes32 = (value) => {
  const out = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
};
const bytesToBigInt = (bytes) =>
  bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
const bigIntToBytes32 = toBytes32;

/** Compressed SEC1 public key (33 bytes) for a 32-byte private key. */
function publicKey(privateKeyBytes) {
  const d = bytesToBigInt(privateKeyBytes);
  if (d <= 0n || d >= N) throw new Error('private key out of range');
  const point = pointMultiply(d);
  const out = new Uint8Array(33);
  out[0] = point.y % 2n === 0n ? 0x02 : 0x03;
  out.set(toBytes32(point.x), 1);
  return out;
}


// --- docs/js/crypto/bip39.js ---
// BIP-39: wordlist handling, checksum validation, entropy <-> mnemonic, seed.
const WORD_INDEX = new Map(WORDLIST.map((word, i) => [word, i]));
class MnemonicError extends Error {
  constructor(message, kind = 'generic') {
    super(message);
    this.name = 'MnemonicError';
    this.kind = kind;
  }
}

/** NFKD-normalise and collapse whitespace, as the spec requires. */
const normalize = (mnemonic) =>
  mnemonic.toLowerCase().normalize('NFKD').trim().split(/\s+/).join(' ');
const wordAt = (position) => {
  if (!Number.isInteger(position) || position < 1 || position > 2048) {
    throw new RangeError('BIP-39 index must be in 1..2048');
  }
  return WORDLIST[position - 1];
};
const indexOf = (word) => {
  const found = WORD_INDEX.get(word.trim().toLowerCase());
  if (found === undefined)
    throw new Error(`'${word}' is not in the BIP-39 dictionary`);
  return found + 1;
};
const searchWords = (prefix, limit = 40) => {
  const needle = prefix.trim().toLowerCase();
  const hits = [];
  for (let i = 0; i < WORDLIST.length && hits.length < limit; i++) {
    if (WORDLIST[i].startsWith(needle)) hits.push([i + 1, WORDLIST[i]]);
  }
  return hits;
};

const bitsOf = (bytes) =>
  Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');

/** Turn 128..256 bits of entropy into a checksummed mnemonic. */
function entropyToMnemonic(entropy) {
  if (![16, 20, 24, 28, 32].includes(entropy.length)) {
    throw new MnemonicError(
      'ENTROPY MUST BE 16, 20, 24, 28 OR 32 BYTES',
      'entropy_length',
    );
  }
  const checksumBits = (entropy.length * 8) / 32;
  const bits = bitsOf(entropy) + bitsOf(sha256(entropy)).slice(0, checksumBits);
  const words = [];
  for (let i = 0; i < bits.length; i += 11)
    words.push(WORDLIST[parseInt(bits.slice(i, i + 11), 2)]);
  return words.join(' ');
}

/**
 * Validate length, dictionary membership and the SHA-256 checksum carried by
 * the final word. Throws MnemonicError with a machine-readable `kind`.
 */
function validateMnemonic(mnemonic) {
  const words = normalize(mnemonic).split(' ').filter(Boolean);
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new MnemonicError(
      `MNEMONIC LENGTH ${words.length} INVALID. EXPECTED 12/15/18/21/24 WORDS.`,
      'length',
    );
  }
  const unknown = words.filter((word) => !WORD_INDEX.has(word));
  if (unknown.length) {
    throw new MnemonicError(
      `WORD NOT IN BIP-39 DICTIONARY: ${unknown.join(', ')}`,
      'dictionary',
    );
  }
  const bits = words
    .map((word) => WORD_INDEX.get(word).toString(2).padStart(11, '0'))
    .join('');
  const divider = (bits.length * 32) / 33;
  const entropyBits = bits.slice(0, divider);
  const checksumBits = bits.slice(divider);
  const entropy = new Uint8Array(entropyBits.length / 8);
  for (let i = 0; i < entropy.length; i++) {
    entropy[i] = parseInt(entropyBits.slice(i * 8, i * 8 + 8), 2);
  }
  if (bitsOf(sha256(entropy)).slice(0, checksumBits.length) !== checksumBits) {
    throw new MnemonicError(
      'MNEMONIC CHECKSUM INVALID. DECRYPTION FAILED.',
      'checksum',
    );
  }
  return { words, entropy };
}
const mnemonicToEntropy = (mnemonic) =>
  validateMnemonic(mnemonic).entropy;

/** BIP-39 seed: PBKDF2-HMAC-SHA512, 2048 rounds, salt "mnemonic"+passphrase. */
const mnemonicToSeed = (mnemonic, passphrase = '') =>
  pbkdf2Sha512(
    utf8(normalize(mnemonic)),
    utf8(`mnemonic${passphrase}`.normalize('NFKD')),
    2048,
    64,
  );

/** Stable sha256 of a normalised mnemonic — how case answers are stored. */
const fingerprint = (mnemonic) =>
  toHex(sha256(utf8(normalize(mnemonic))));


// --- docs/js/crypto/wallet.js ---
// BIP-32 derivation plus the BIP-44/49/84 address grid the terminal prints.




const concat = (...chunks) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const uint32 = (value) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0);
  return out;
};

const HARDENED = 0x80000000;
class ExtendedKey {
  constructor(key, chainCode, depth = 0, parent = null, childNumber = 0) {
    this.key = key;
    this.chainCode = chainCode;
    this.depth = depth;
    //: The parent node rather than its fingerprint. Computing the fingerprint
    //: costs a point multiplication, and only toExtended() ever reads it —
    //: deriving an address does not. Held as the parent and resolved on demand,
    //: a path like m/44'/0'/0'/0/0 needs three multiplications instead of six.
    this.parent = parent;
    this.childNumber = childNumber;
  }

  static fromSeed(seed) {
    const digest = hmacSha512(new TextEncoder().encode('Bitcoin seed'), seed);
    return new ExtendedKey(digest.subarray(0, 32), digest.subarray(32));
  }

  get publicKey() {
    if (!this._pub) this._pub = publicKey(this.key);
    return this._pub;
  }

  get fingerprint() {
    if (!this._fingerprint)
      this._fingerprint = hash160(this.publicKey).subarray(0, 4);
    return this._fingerprint;
  }

  get parentFingerprint() {
    return this.parent ? this.parent.fingerprint : new Uint8Array(4);
  }

  child(index) {
    const hardened = index >= HARDENED;
    const payload = hardened
      ? concat(new Uint8Array([0]), this.key)
      : this.publicKey;
    const digest = hmacSha512(this.chainCode, concat(payload, uint32(index)));
    const tweak = bytesToBigInt(digest.subarray(0, 32));
    const childKey = (tweak + bytesToBigInt(this.key)) % N;
    if (tweak >= N || childKey === 0n) return this.child(index + 1);
    return new ExtendedKey(
      bigIntToBytes32(childKey),
      digest.subarray(32),
      this.depth + 1,
      this,
      index,
    );
  }

  derivePath(path) {
    return path
      .split('/')
      .map((part) => part.trim())
      .filter((part) => part && part !== 'm' && part !== 'M')
      .reduce((node, part) => {
        const hardened = /['hH]$/.test(part);
        const number = parseInt(part.replace(/['hH]$/, ''), 10);
        if (!Number.isInteger(number))
          throw new Error(`bad derivation path segment: ${part}`);
        return node.child(hardened ? number + HARDENED : number);
      }, this);
  }

  toExtended(version) {
    return base58CheckEncode(
      concat(
        version,
        new Uint8Array([this.depth]),
        this.parentFingerprint,
        uint32(this.childNumber),
        this.chainCode,
        new Uint8Array([0]),
        this.key,
      ),
    );
  }

  toWif() {
    return base58CheckEncode(
      concat(new Uint8Array([0x80]), this.key, new Uint8Array([1])),
    );
  }
}

const p2pkh = (pub) =>
  base58CheckEncode(concat(new Uint8Array([0x00]), hash160(pub)));
const p2shP2wpkh = (pub) => {
  const redeem = concat(new Uint8Array([0x00, 0x14]), hash160(pub));
  return base58CheckEncode(concat(new Uint8Array([0x05]), hash160(redeem)));
};
const p2wpkh = (pub) => segwitAddress('bc', 0, hash160(pub));
const PURPOSES = [
  {
    purpose: 44,
    label: 'Legacy P2PKH',
    encode: p2pkh,
    version: new Uint8Array([0x04, 0x88, 0xad, 0xe4]),
  },
  {
    purpose: 49,
    label: 'Nested SegWit',
    encode: p2shP2wpkh,
    version: new Uint8Array([0x04, 0x9d, 0x78, 0x78]),
  },
  {
    purpose: 84,
    label: 'Native SegWit',
    encode: p2wpkh,
    version: new Uint8Array([0x04, 0xb2, 0x43, 0x0c]),
  },
];

/** Full chain: mnemonic -> seed -> master xprv -> account keys -> addresses. */
function deriveWallet(
  mnemonic,
  { passphrase = '', account = 0, index = 0 } = {},
) {
  validateMnemonic(mnemonic);
  const seed = mnemonicToSeed(mnemonic, passphrase);
  const master = ExtendedKey.fromSeed(seed);

  const addresses = PURPOSES.map(({ purpose, label, encode, version }) => {
    const path = `m/${purpose}'/0'/${account}'/0/${index}`;
    const node = master.derivePath(path);
    const accountNode = master.derivePath(`m/${purpose}'/0'/${account}'`);
    return {
      purpose,
      label,
      path,
      address: encode(node.publicKey),
      publicKey: toHex(node.publicKey),
      wif: node.toWif(),
      extendedPrivateKey: accountNode.toExtended(version),
    };
  });

  return {
    mnemonic: normalize(mnemonic),
    seed: toHex(seed),
    masterXprv: master.toExtended(new Uint8Array([0x04, 0x88, 0xad, 0xe4])),
    addresses,
    primary: addresses.find((entry) => entry.purpose === 44),
  };
}
{ sha256 };


globalThis.EnigmaBridge = {
  validateMnemonic: function(phrase) {
    try {
      var res = validateMnemonic(phrase);
      var words = normalize(phrase).split(' ').filter(Boolean);
      return JSON.stringify({ valid: true, checksum: true, words: words });
    } catch (e) {
      return JSON.stringify({ valid: false, checksum: false, error: e.message });
    }
  },
  deriveWallet: function(phrase) {
    try {
      var res = deriveWallet(phrase);
      return JSON.stringify(res);
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  },
  completeMnemonic: function(pattern) {
    var words = normalize(pattern).split(' ').filter(Boolean);
    var idx = words.indexOf('?');
    if (idx === -1) idx = words.indexOf('_');
    if (idx === -1) return JSON.stringify({ error: 'NO_BLANK' });
    var candidates = [];
    for (var i = 0; i < WORDLIST.length; i++) {
      words[idx] = WORDLIST[i];
      try {
        validateMnemonic(words.join(' '));
        candidates.push(WORDLIST[i]);
      } catch (e) {}
    }
    return JSON.stringify({ position: idx, candidates: candidates });
  },
  searchWords: function(prefix, limit) {
    var results = searchWords(prefix, limit || 20);
    return JSON.stringify(results);
  },
  wordAt: function(pos) {
    try {
      return wordAt(pos);
    } catch (e) {
      return null;
    }
  },
  indexOf: function(word) {
    try {
      return indexOf(word);
    } catch(e) {
      return -1;
    }
  }
};
