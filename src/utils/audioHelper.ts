// Format seconds to "MM:SS" (e.g. 185 -> "03:05")
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Decode audio file into AudioBuffer using Web Audio API
export const decodeAudioFile = async (file: Blob): Promise<AudioBuffer> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
};

// Slice an AudioBuffer between start and end times, applying optional fade-in and fade-out
export const sliceAudioBuffer = (
  buffer: AudioBuffer,
  startTime: number,
  endTime: number,
  applyFadeIn: boolean = false,
  applyFadeOut: boolean = false
): AudioBuffer => {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;

  const startSample = Math.max(0, Math.floor(startTime * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endTime * sampleRate));
  const frameCount = Math.max(1, endSample - startSample);

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const newBuffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);

  const fadeInDuration = 1.5; // seconds
  const fadeOutDuration = 2.0; // seconds
  const fadeInFrames = Math.min(frameCount, Math.floor(fadeInDuration * sampleRate));
  const fadeOutFrames = Math.min(frameCount, Math.floor(fadeOutDuration * sampleRate));

  for (let channel = 0; channel < numChannels; channel++) {
    const originalData = buffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    for (let i = 0; i < frameCount; i++) {
      let sample = originalData[startSample + i];

      // Apply Fade-in
      if (applyFadeIn && i < fadeInFrames) {
        sample *= i / fadeInFrames;
      }

      // Apply Fade-out
      if (applyFadeOut && i >= frameCount - fadeOutFrames) {
        const remaining = frameCount - i;
        sample *= remaining / fadeOutFrames;
      }

      newData[i] = sample;
    }
  }

  return newBuffer;
};
