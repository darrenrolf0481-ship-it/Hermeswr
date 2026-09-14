import { useState, useEffect, useRef, useCallback } from 'react';
import { sound } from '../utils/audio';

export interface TacticalVoiceCommand {
  command: string;
  action: () => void;
  description: string;
}

interface UseTacticalSpeechRecognitionOptions {
  onFinalTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onAutoDispatch?: (fullText: string) => void;
  onCommandTriggered?: (commandName: string) => void;
  autoDispatchDelayMs?: number; // Silence delay before auto-dispatch in hands-free mode
}

export const useTacticalSpeechRecognition = ({
  onFinalTranscript,
  onInterimTranscript,
  onAutoDispatch,
  onCommandTriggered,
  autoDispatchDelayMs = 2200,
}: UseTacticalSpeechRecognitionOptions = {}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const shouldKeepListeningRef = useRef<boolean>(false);
  const accumulatedTextRef = useRef<string>('');

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // Clear silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Start animated audio wave simulation when listening
  const startAudioSimulation = useCallback(() => {
    const updateLevel = () => {
      // Create tactical dynamic audio meter fluctuation
      const base = 0.3 + Math.random() * 0.7;
      setAudioLevel(base);
      audioAnimationRef.current = requestAnimationFrame(updateLevel);
    };
    audioAnimationRef.current = requestAnimationFrame(updateLevel);
  }, []);

  const stopAudioSimulation = useCallback(() => {
    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    clearSilenceTimer();
    stopAudioSimulation();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setIsListening(false);
    sound.micOff();
  }, [clearSilenceTimer, stopAudioSimulation]);

  const startListening = useCallback(() => {
    setError(null);
    clearSilenceTimer();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Web Speech API is not supported in this browser. Use Chrome or Chromium-based browser.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        shouldKeepListeningRef.current = true;
        sound.micOn();
        startAudioSimulation();
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalSegment = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) {
            finalSegment += text + ' ';
          } else {
            currentInterim += text;
          }
        }

        if (finalSegment) {
          accumulatedTextRef.current = (accumulatedTextRef.current + ' ' + finalSegment).trim();
          setTranscript(accumulatedTextRef.current);
          setInterimTranscript('');
          if (onFinalTranscript) {
            onFinalTranscript(accumulatedTextRef.current);
          }

          // Tactical command check
          const lower = finalSegment.toLowerCase().trim();
          if (
            lower.includes('transmit directive') || 
            lower.includes('execute directive') || 
            lower.includes('execute command') || 
            lower.includes('dispatch directive')
          ) {
            clearSilenceTimer();
            if (onCommandTriggered) onCommandTriggered('TRANSMIT');
            if (onAutoDispatch) {
              // Strip command keyword from payload
              const cleaned = accumulatedTextRef.current
                .replace(/transmit directive/gi, '')
                .replace(/execute directive/gi, '')
                .replace(/execute command/gi, '')
                .replace(/dispatch directive/gi, '')
                .trim();
              onAutoDispatch(cleaned || accumulatedTextRef.current);
              accumulatedTextRef.current = '';
              setTranscript('');
              setInterimTranscript('');
            }
            return;
          }

          if (lower.includes('clear directive') || lower.includes('abort directive')) {
            clearSilenceTimer();
            accumulatedTextRef.current = '';
            setTranscript('');
            setInterimTranscript('');
            if (onCommandTriggered) onCommandTriggered('CLEAR');
            return;
          }

          if (lower.includes('attach schematic') || lower.includes('attach sketch')) {
            if (onCommandTriggered) onCommandTriggered('ATTACH_SKETCH');
            accumulatedTextRef.current = accumulatedTextRef.current
              .replace(/attach schematic/gi, '')
              .replace(/attach sketch/gi, '')
              .trim();
            setTranscript(accumulatedTextRef.current);
          }

          // In hands-free mode, trigger auto-dispatch timer on final speech pause
          if (handsFreeMode && accumulatedTextRef.current.trim().length > 3) {
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
              const textToSend = accumulatedTextRef.current.trim();
              if (textToSend && onAutoDispatch) {
                onAutoDispatch(textToSend);
                accumulatedTextRef.current = '';
                setTranscript('');
                setInterimTranscript('');
              }
            }, autoDispatchDelayMs);
          }
        } else if (currentInterim) {
          setInterimTranscript(currentInterim);
          if (onInterimTranscript) {
            onInterimTranscript(currentInterim);
          }
          // Reset silence timer while actively speaking
          clearSilenceTimer();
        }
      };

      recognition.onerror = (event: any) => {
        // Handle common speech errors
        if (event.error === 'no-speech') {
          // Normal pause, ignore in continuous mode
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('Microphone access denied. Grant microphone permission in browser.');
          stopListening();
          return;
        }
        if (event.error === 'network') {
          setError('Speech recognition network error. Verify internet uplink.');
        }
      };

      recognition.onend = () => {
        // If hands-free mode is on and we didn't intentionally stop, auto-restart
        if (shouldKeepListeningRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            // Restart failed
          }
        }
        setIsListening(false);
        stopAudioSimulation();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Speech Recognition.');
      setIsListening(false);
      stopAudioSimulation();
    }
  }, [
    clearSilenceTimer,
    startAudioSimulation,
    stopAudioSimulation,
    onFinalTranscript,
    onInterimTranscript,
    onAutoDispatch,
    onCommandTriggered,
    handsFreeMode,
    autoDispatchDelayMs,
    stopListening
  ]);

  const toggleListening = useCallback(() => {
    sound.click();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    accumulatedTextRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    clearSilenceTimer();
  }, [clearSilenceTimer]);

  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      clearSilenceTimer();
      stopAudioSimulation();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
    };
  }, [clearSilenceTimer, stopAudioSimulation]);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    error,
    handsFreeMode,
    setHandsFreeMode,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
};
