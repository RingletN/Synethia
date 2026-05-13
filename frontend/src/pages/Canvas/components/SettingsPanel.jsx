// SettingsPanel.jsx
import React from 'react';

// ─── Маленький компонент: слайдер с лейблом ───────────────────────────────────
const SliderRow = ({ label, value, min, max, step = 1, onChange, unit = '', displayValue }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em',
            textTransform: 'uppercase',
        }}>
            <span>{label}</span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>
                {displayValue !== undefined ? displayValue : value}{unit}
            </span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#00ffd1', cursor: 'pointer' }}
        />
    </div>
);

// ─── Маленький компонент: выбор из нескольких кнопок ─────────────────────────
const SelectRow = ({ label, options, value, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{
            fontSize: 12, color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
            {label}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        border: '1.5px solid',
                        borderColor: value === opt.value ? '#00ffd1' : 'rgba(255,255,255,0.15)',
                        background: value === opt.value
                            ? 'rgba(0,255,209,0.12)'
                            : 'rgba(255,255,255,0.04)',
                        color: value === opt.value ? '#00ffd1' : 'rgba(255,255,255,0.6)',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.18s',
                        letterSpacing: '0.04em',
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

// ─── Разделитель секций ────────────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2,
    }}>
        <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
            whiteSpace: 'nowrap',
        }}>
            {children}
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />
    </div>
);

// ─── Главный компонент ─────────────────────────────────────────────────────────
const SettingsPanel = ({
    // Параметры генерации
    bpm,           onBpmChange,
    duration,      onDurationChange,
    scale,         onScaleChange,
    smoothing,     onSmoothingChange,

    // Эффекты (0..1 каждый)
    effectReverb,     onReverbChange,
    effectDelay,      onDelayChange,
    effectDistortion, onDistortionChange,
}) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            padding: '28px 24px',
            height: '100%',
            boxSizing: 'border-box',
            overflowY: 'auto',
        }}>

            {/* ── Генерация ─────────────────────────────────────── */}
            <SectionTitle>Генерация</SectionTitle>

            <SliderRow
                label="Темп"
                value={bpm}
                min={40}
                max={180}
                step={1}
                unit=" BPM"
                onChange={onBpmChange}
            />

            <SliderRow
                label="Длительность"
                value={duration}
                min={4}
                max={32}
                step={1}
                unit=" с"
                onChange={onDurationChange}
            />

            <SliderRow
                label="Сглаживание"
                value={smoothing}
                min={0}
                max={80}
                step={5}
                unit="%"
                onChange={onSmoothingChange}
            />

            <SelectRow
                label="Гамма"
                value={scale}
                onChange={onScaleChange}
                options={[
                    { value: 'major',      label: 'Мажор' },
                    { value: 'minor',      label: 'Минор' },
                ]}
            />

            {/* ── Эффекты ───────────────────────────────────────── */}
            <SectionTitle>Эффекты</SectionTitle>

            <SliderRow
                label="Реверб"
                value={Math.round(effectReverb * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => onReverbChange(v / 100)}
            />

            <SliderRow
                label="Дилэй"
                value={Math.round(effectDelay * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => onDelayChange(v / 100)}
            />

            <SliderRow
                label="Дисторшн"
                value={Math.round(effectDistortion * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={v => onDistortionChange(v / 100)}
            />

        </div>
    );
};

export default SettingsPanel;