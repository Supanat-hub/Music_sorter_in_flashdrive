import { Mp3Encoder } from '@breezystack/lamejs';

// Convert Float32Array to 16-bit PCM Int16Array
const convertFloatToInt16 = (float32Array: Float32Array): Int16Array => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
};

// Encode an AudioBuffer into an MP3 Blob with non-blocking async yielding
export const encodeAudioBufferToMp3 = async (
  buffer: AudioBuffer,
  kbps: number = 192,
  onProgress?: (percent: number) => void
): Promise<Blob> => {
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps);

  const mp3Data: Uint8Array[] = [];
  const sampleBlockSize = 1152; // LAME standard block size

  if (channels === 1) {
    const samples = convertFloatToInt16(buffer.getChannelData(0));
    const totalSamples = samples.length;

    for (let i = 0; i < totalSamples; i += sampleBlockSize) {
      const sampleChunk = samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }

      // Yield every ~30 chunks to allow React & browser to paint the progress bar and spinner
      if (i % (sampleBlockSize * 30) === 0) {
        if (onProgress) {
          onProgress(Math.round((i / totalSamples) * 100));
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  } else {
    const leftSamples = convertFloatToInt16(buffer.getChannelData(0));
    const rightSamples = convertFloatToInt16(buffer.getChannelData(1));
    const totalSamples = leftSamples.length;

    for (let i = 0; i < totalSamples; i += sampleBlockSize) {
      const leftChunk = leftSamples.subarray(i, i + sampleBlockSize);
      const rightChunk = rightSamples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }

      // Yield every ~30 chunks to allow React & browser to paint the progress bar and spinner
      if (i % (sampleBlockSize * 30) === 0) {
        if (onProgress) {
          onProgress(Math.round((i / totalSamples) * 100));
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  // Flush remaining buffer
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf));
  }

  if (onProgress) onProgress(100);

  return new Blob(mp3Data, { type: 'audio/mp3' });
};
