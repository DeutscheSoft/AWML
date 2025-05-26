
function bufferToString(buffer) {
  buffer = toUint8Array(buffer);
  const chunks = [];

  for (let i = 0; i < buffer.length; i += 256)
  {
    const subarray = buffer.subarray(i, i + 256);

    chunks.push(
      String.fromCharCode(...subarray)
    );
  }

  return chunks.join('');
}

function stringToBuffer(str) {
  const result = new Uint8Array(str.length);

  for (let i = 0; i < str.length; i++)
  {
    result[i] = str.charCodeAt(i);
  }

  return result;
}

function toUint8Array(buffer) {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

let encodeBase64, decodeBase64;

if ('fromBase64' in Uint8Array) {
  const options = {
    lastChunkHandling: "strict",
  };

  decodeBase64 = function (str) {
    return Uint8Array.fromBase64(str, options);
  };
} else {
  decodeBase64 = function (str) {
    return stringToBuffer(atob(str));
  };
}


if ('toBase64' in Uint8Array.prototype) {
  encodeBase64 = function (buffer) {
    return toUint8Array(buffer).toBase64();
  };
} else {
  encodeBase64 = function (buffer) {
    return btoa(bufferToString(buffer));
  };
}

export { decodeBase64, encodeBase64 };
