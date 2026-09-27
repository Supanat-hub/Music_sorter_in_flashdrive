import fs from 'fs';
import path from 'path';

// Function to generate a simple WAV file with a sine wave tone
function createWavFile(filename, durationSec, freq) {
  const sampleRate = 44100;
  const numSamples = durationSec * sampleRate;
  const byteRate = sampleRate * 2; // 16-bit mono = 2 bytes per sample
  const dataSize = numSamples * 2;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM = 1)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28);   // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate sine wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t);
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filename, buffer);
  console.log(`Generated: ${filename}`);
}

createWavFile('sample_music/เพลงเต้นแอโรบิค_จังหวะเร็ว.wav', 5, 440);
createWavFile('sample_music/เพลงเต้น_โบว์รักสีดำ_รีมิกซ์.wav', 6, 523);
createWavFile('sample_music/เพลงคูลดาวน์_ยามเย็น.wav', 4, 330);
