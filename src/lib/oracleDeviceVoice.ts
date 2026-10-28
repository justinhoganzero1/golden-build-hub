export interface DeviceVoiceCandidate { name: string; lang: string; localService: boolean; }
export function deviceVoiceScore(voice: DeviceVoiceCandidate) {
  const name = voice.name.toLowerCase();
  return (/natural|neural|enhanced|premium/.test(name) ? 100 : 0)
    + (!voice.localService ? 35 : 0)
    + (/^en[-_]AU$/i.test(voice.lang) ? 30 : 0)
    + (/karen|catherine|natasha|hayley|samantha|zira|aria|jenny|female/.test(name) ? 25 : 0)
    + (/google|microsoft/.test(name) ? 10 : 0);
}
export function chooseOracleDeviceVoice<T extends DeviceVoiceCandidate>(voices: T[]): T | undefined {
  return voices.filter(voice => /^en(?:[-_]|$)/i.test(voice.lang)).sort((a, b) => deviceVoiceScore(b) - deviceVoiceScore(a))[0];
}
export function naturalDeviceSpeechText(text: string) { return text.trim(); }