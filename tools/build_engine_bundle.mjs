import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  'docs/js/wordlist.js',
  'docs/js/crypto/hash.js',
  'docs/js/crypto/encoding.js',
  'docs/js/crypto/secp256k1.js',
  'docs/js/crypto/bip39.js',
  'docs/js/crypto/wallet.js'
];
let bundle = `// Bundled Enigma Crypto Engine for JavaScriptCore
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
`;

for (const relPath of files) {
  const fullPath = join(ROOT, relPath);
  let src = readFileSync(fullPath, 'utf8');

  // Remove import statements
  src = src.replace(/^\s*import\s+[^;]+;\s*$/gm, '');

  // Replace `export const/class/function/let` with `const/class/function/let`
  src = src.replace(/^\s*export\s+(default\s+)?/gm, '');

  bundle += `\n// --- ${relPath} ---\n` + src + '\n';
}

bundle += `
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
`;

const outPath = join(ROOT, 'macos/EnigmaTerminal/Resources/enigma_engine.js');
writeFileSync(outPath, bundle, 'utf8');
console.log('Successfully bundled engine to', outPath, 'size:', bundle.length);
