/**
 * Произношение через встроенный синтез речи.
 * Внутри вебвью телеграма его иногда просто нет — тогда всё молча
 * выключается, а кнопка озвучки не рисуется. Ошибок наружу не отдаём.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

export const canSpeak = Boolean(synth);

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!synth) return null;
  if (voice) return voice;
  const voices = synth.getVoices();
  if (voices.length === 0) return null;
  voice =
    voices.find((v) => v.lang === 'en-US' && v.localService) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null;
  return voice;
}

if (synth) {
  // Список голосов приезжает асинхронно — перевыбираем, когда приедет.
  synth.addEventListener?.('voiceschanged', () => {
    voice = null;
    pickVoice();
  });
}

export function speak(text: string): void {
  if (!synth) return;
  try {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    const chosen = pickVoice();
    if (chosen) utterance.voice = chosen;
    synth.speak(utterance);
  } catch {
    /* синтез недоступен — молчим */
  }
}
