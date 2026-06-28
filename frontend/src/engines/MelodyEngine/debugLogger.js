// Форматированный вывод событий движка мелодии для отладки

import { freqToMidi } from "./musicTheory.js";

export function exportDebugLog(events, roles, tonicMidi, options = {}) {
  const {
    bpm = 80,
    scale = "major",
    rhythmPattern = "straight",
    duration = 8,
    legato = false,
    voiceMode = "random",
  } = options;

  const T = Math.max(1, Math.ceil((bpm * duration) / (60 * 4)));
  const beatDuration = duration / T;
  const lines = [];

  lines.push("═══════════════════════════════════════════");
  lines.push("  MELODY ENGINE DEBUG LOG");
  lines.push("═══════════════════════════════════════════");
  lines.push(
    `  BPM: ${bpm} | Scale: ${scale} | Pattern: ${rhythmPattern} | Legato: ${legato} | VoiceMode: ${voiceMode}`,
  );
  lines.push(
    `  Duration: ${duration}s | Тактов: ${T} | Тоника: ${midiToName(tonicMidi)} (midi ${tonicMidi})`,
  );
  lines.push("");
  lines.push("─── Роли инструментов ──────────────────────");
  for (const [instr, role] of Object.entries(roles)) {
    lines.push(`  ${instr.padEnd(18)} → ${role}`);
  }
  lines.push("");
  lines.push("─── События по тактам ──────────────────────");

  const byTakt = new Map();
  for (const ev of events) {
    const takt = Math.floor(ev.time / beatDuration);
    if (!byTakt.has(takt)) byTakt.set(takt, []);
    byTakt.get(takt).push(ev);
  }

  for (let k = 0; k < T; k++) {
    const taktEvents = byTakt.get(k) || [];
    lines.push(
      `\n  [Такт ${String(k + 1).padStart(2, "0")}]  t=${(k * beatDuration).toFixed(2)}s`,
    );
    if (taktEvents.length === 0) {
      lines.push("    (пусто)");
      continue;
    }
    for (const ev of taktEvents.sort((a, b) => a.time - b.time)) {
      const midi = Math.round(freqToMidi(ev.freq));
      const noteName = midiToName(midi);
      const volBar = "█".repeat(Math.round(ev.volume * 10)).padEnd(10, "░");
      const durStr = ev.duration.toFixed(3) + "s";
      const timeStr = ev.time.toFixed(3) + "s";
      lines.push(
        `    ${timeStr}  ${noteName.padEnd(4)} midi:${String(midi).padStart(3)}` +
          `  dur:${durStr}  vol:${volBar}  [${ev.role.padEnd(6)}] ${ev.instrument}` +
          `${ev.interpolated ? "  ~interp" : ""}`,
      );
    }
  }

  lines.push("\n═══════════════════════════════════════════\n");
  return lines.join("\n");
}

// ─── хелпер ──────────────────────────────────────────────────────────────────

function midiToName(midi) {
  const names = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  return names[((midi % 12) + 12) % 12] + Math.floor(midi / 12 - 1);
}
