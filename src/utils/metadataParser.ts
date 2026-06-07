export interface ParsedMetadata {
  title: string;
  artist: string;
  album: string;
  coverUrl?: string;
}

// Decodes text bytes to string based on encoding byte
function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      // Latin-1 / ISO-8859-1
      return new TextDecoder('windows-1252').decode(bytes);
    } else if (encoding === 1) {
      // UTF-16 with BOM
      return new TextDecoder('utf-16').decode(bytes);
    } else if (encoding === 2) {
      // UTF-16BE without BOM
      return new TextDecoder('utf-16be').decode(bytes);
    } else if (encoding === 3) {
      // UTF-8
      return new TextDecoder('utf-8').decode(bytes);
    }
  } catch (e) {
    console.error('Error decoding text', e);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

// Reads a null-terminated string from bytes
function readNullTerminatedString(bytes: Uint8Array, offset: number, encoding: number): { str: string; bytesRead: number } {
  let end = offset;
  if (encoding === 1 || encoding === 2) {
    // UTF-16 uses 2 bytes for null terminator
    while (end < bytes.length - 1) {
      if (bytes[end] === 0 && bytes[end + 1] === 0) {
        break;
      }
      end += 2;
    }
    const strBytes = bytes.slice(offset, end);
    return {
      str: decodeText(strBytes, encoding),
      bytesRead: end - offset + 2,
    };
  } else {
    // 1-byte encoding null terminator
    while (end < bytes.length) {
      if (bytes[end] === 0) {
        break;
      }
      end++;
    }
    const strBytes = bytes.slice(offset, end);
    return {
      str: decodeText(strBytes, encoding),
      bytesRead: end - offset + 1,
    };
  }
}

export async function parseMetadata(file: File): Promise<ParsedMetadata> {
  const result: ParsedMetadata = {
    title: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "), // Fallback title
    artist: "Unknown Artist",
    album: "Unknown Album",
  };

  // Only parse MP3 files for ID3 tags
  if (!file.name.toLowerCase().endsWith('.mp3')) {
    return result;
  }

  try {
    // Read the first 256KB of the file (should contain the ID3 header)
    const headerBuffer = await file.slice(0, 256 * 1024).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);

    // Check for "ID3" identifier
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
      return result;
    }

    const majorVersion = bytes[3];
    const synchsafeSize = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
    const tagSize = Math.min(synchsafeSize + 10, bytes.length);

    let offset = 10; // Skip 10 bytes header
    while (offset < tagSize - 10) {
      // Read frame ID
      const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
      
      // If frame ID is empty or invalid, we are done
      if (!/^[A-Z0-9]{4}$/.test(frameId)) {
        break;
      }

      // Read frame size
      let frameSize = 0;
      if (majorVersion === 4) {
        // ID3v2.4 uses synchsafe sizes for frames
        frameSize = (bytes[offset + 4] << 21) | (bytes[offset + 5] << 14) | (bytes[offset + 6] << 7) | bytes[offset + 7];
      } else {
        // ID3v2.3 uses standard 32-bit int sizes
        frameSize = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
      }

      // Safeguard against bad frame sizes
      if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) {
        break;
      }

      const frameData = bytes.slice(offset + 10, offset + 10 + frameSize);
      offset += 10 + frameSize;

      if (frameId === 'TIT2') {
        const encoding = frameData[0];
        result.title = decodeText(frameData.slice(1), encoding).trim().replace(/\0/g, '');
      } else if (frameId === 'TPE1') {
        const encoding = frameData[0];
        result.artist = decodeText(frameData.slice(1), encoding).trim().replace(/\0/g, '');
      } else if (frameId === 'TALB') {
        const encoding = frameData[0];
        result.album = decodeText(frameData.slice(1), encoding).trim().replace(/\0/g, '');
      } else if (frameId === 'APIC') {
        try {
          const encoding = frameData[0];
          // Find mime type
          let mimeOffset = 1;
          let mimeType = 'image/jpeg';
          const mimeRes = readNullTerminatedString(frameData, mimeOffset, 0); // mime type is always ISO-8859-1 (0)
          mimeType = mimeRes.str;
          mimeOffset += mimeRes.bytesRead;

          mimeOffset += 1; // skip picture type byte

          // skip description
          const descRes = readNullTerminatedString(frameData, mimeOffset, encoding);
          mimeOffset += descRes.bytesRead;

          // Remaining is image data
          const imgBytes = frameData.slice(mimeOffset);
          if (imgBytes.length > 0) {
            const blob = new Blob([imgBytes], { type: mimeType });
            result.coverUrl = URL.createObjectURL(blob);
          }
        } catch (e) {
          console.error('Error parsing cover art APIC frame', e);
        }
      }
    }
  } catch (err) {
    console.error('Error parsing metadata:', err);
  }

  return result;
}
