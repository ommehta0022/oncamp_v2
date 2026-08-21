import React from "react";

/**
 * Voice notes are intentionally not part of the OnCampus product scope.
 * This compatibility component renders nothing so older imports cannot expose
 * microphone recording UI. Group text/image messaging remains supported.
 */
export default function VoiceNoteRecorder(_props: {
  disabled?: boolean;
  onReady: (uri: string, durationMs: number) => Promise<void> | void;
}) {
  return null;
}
