// LZString.decompressFromBase64 — minimal, dependency-free port of the
// algorithm used by the Obsidian Excalidraw plugin for ```compressed-json```
// drawing blocks (pieroxy/lz-string, MIT). Decompression only: dual-views
// reads plugin-saved drawings but always writes plain JSON.

const KEY_STR_BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export function decompressFromBase64(input) {
  if (input == null) return "";
  if (input === "") return null;
  return decompress(input.length, 32, (i) => KEY_STR_BASE64.indexOf(input.charAt(i)));
}

function decompress(length, resetValue, getNextValue) {
  const dictionary = [];
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let entry = "";
  const result = [];
  let w;
  let bits = 0;
  let c;

  const data = { val: getNextValue(0), position: resetValue, index: 1 };
  for (let i = 0; i < 3; i += 1) dictionary[i] = i;

  const readBits = (n) => {
    let b = 0;
    let maxpower = Math.pow(2, n);
    let power = 1;
    while (power !== maxpower) {
      const resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      b |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }
    return b;
  };

  switch ((c = readBits(2))) {
    case 0:
      c = String.fromCharCode(readBits(8));
      break;
    case 1:
      c = String.fromCharCode(readBits(16));
      break;
    case 2:
      return "";
    default:
      return null;
  }
  dictionary[3] = c;
  w = c;
  result.push(c);

  while (true) {
    if (data.index > length) {
      return "";
    }
    c = readBits(numBits);
    switch (c) {
      case 0:
        dictionary[dictSize++] = String.fromCharCode(readBits(8));
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 1:
        dictionary[dictSize++] = String.fromCharCode(readBits(16));
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 2:
        return result.join("");
    }
    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits++;
    }

    if (dictionary[c]) {
      entry = dictionary[c];
    } else {
      if (c === dictSize) {
        entry = w + w.charAt(0);
      } else {
        return null;
      }
    }
    result.push(entry);

    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn--;
    w = entry;

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits++;
    }
  }
}
