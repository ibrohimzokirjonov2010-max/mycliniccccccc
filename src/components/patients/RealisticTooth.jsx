import React, { useEffect, useRef } from 'react';
import fdiChart from '@/assets/teeth/fdi-chart.png';

const TOP_ORDER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const BOTTOM_ORDER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const CUSTOM_TOOTH_SRC = {
  // FDI mappings for upper right (11-18)
  '11': '/teeth/kamron/tepa_ong_1.png',
  '12': '/teeth/kamron/tepa_ong_2.png',
  '13': '/teeth/kamron/tepa_ong_3.png',
  '14': '/teeth/kamron/tepa_ong_4.png',
  '15': '/teeth/kamron/tepa_ong_5.png',
  '16': '/teeth/kamron/tepa_ong_6.png',
  '17': '/teeth/kamron/tepa_ong_7.png',
  '18': '/teeth/kamron/tepa_ong_8.png',

  // FDI mappings for upper left (21-28)
  '21': '/teeth/kamron/tepa_chap_1.png',
  '22': '/teeth/kamron/tepa_chap_2.png',
  '23': '/teeth/kamron/tepa_chap_3.png',
  '24': '/teeth/kamron/tepa_chap_4.png',
  '25': '/teeth/kamron/tepa_chap_5.png',
  '26': '/teeth/kamron/tepa_chap_6.png',
  '27': '/teeth/kamron/tepa_chap_7.png',
  '28': '/teeth/kamron/tepa_chap_8.png',

  // FDI mappings for lower left (31-38)
  '31': '/teeth/kamron/pas_chap_1.png',
  '32': '/teeth/kamron/pas_chap_2.png',
  '33': '/teeth/kamron/pas_chap_3.png',
  '34': '/teeth/kamron/pas_chap_4.png',
  '35': '/teeth/kamron/pas_chap_5.png',
  '36': '/teeth/kamron/pas_chap_6.png',
  '37': '/teeth/kamron/pas_chap_7.png',
  '38': '/teeth/kamron/pas_chap_8.png',

  // FDI mappings for lower right (41-48)
  '41': '/teeth/kamron/pas_ong_1.png',
  '42': '/teeth/kamron/pas_ong_2.png',
  '43': '/teeth/kamron/pas_ong_3.png',
  '44': '/teeth/kamron/pas_ong_4.png',
  '45': '/teeth/kamron/pas_ong_5.png',
  '46': '/teeth/kamron/pas_ong_6.png',
  '47': '/teeth/kamron/pas_ong_7.png',
  '48': '/teeth/kamron/pas_ong_8.png',
};

/** Chap tomondagi tishlar — bir xil assetni o'ng tomonga aynalatish */
const CUSTOM_TOOTH_MIRROR = new Set([]);

const getToothType = (num) => {
  const d = Number(num) % 10;
  if (d >= 6 || d === 0) return 'molar';
  if (d >= 4) return 'premolar';
  if (d === 3) return 'canine';
  return 'incisor';
};

const ATLAS = (() => {
  const map = {};
  // Center-based slicing reduces neighboring tooth bleed
  const centerStart = 67;
  const step = 58.8;
  // Taller crop so every tooth is fully visible
  const topY = 92;
  const bottomY = 266;
  const topCropH = 158;
  const bottomCropH = 170;

  TOP_ORDER.forEach((num, idx) => {
    const type = getToothType(num);
    const w = type === 'molar' ? 56 : type === 'premolar' ? 50 : 46;
    const cx = centerStart + idx * step;
    map[num] = { x: Math.round(cx - w / 2), y: topY, w, h: topCropH };
  });

  BOTTOM_ORDER.forEach((num, idx) => {
    const type = getToothType(num);
    const w = type === 'molar' ? 56 : type === 'premolar' ? 50 : 46;
    const cx = centerStart + idx * step;
    map[num] = { x: Math.round(cx - w / 2), y: bottomY, w, h: bottomCropH };
  });

  return map;
})();

let atlasImage;

export default function RealisticTooth({
  number,
  selected = false,
  size = 34,
  className = '',
}) {
  const customSrc = CUSTOM_TOOTH_SRC[number];
  const isCustomTooth = Boolean(customSrc);
  const pos = ATLAS[number] || ATLAS[11];
  const targetW = size;
  const scale = targetW / pos.w;
  const targetH = Math.round(pos.h * scale);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isCustomTooth) return;

    if (!atlasImage) {
      atlasImage = new Image();
      atlasImage.src = fdiChart;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(
        atlasImage,
        pos.x,
        pos.y,
        pos.w,
        pos.h,
        0,
        0,
        targetW,
        targetH
      );
    };

    if (atlasImage.complete) {
      draw();
      return;
    }

    atlasImage.addEventListener('load', draw);
    return () => {
      atlasImage.removeEventListener('load', draw);
    };
  }, [isCustomTooth, number, pos.x, pos.y, pos.w, pos.h, targetW, targetH]);

  if (isCustomTooth) {
    const mirror = CUSTOM_TOOTH_MIRROR.has(number);
    const oldToothFilter = selected
      ? 'contrast(1.1) brightness(1.0) drop-shadow(0 4px 6px rgba(59,130,246,0.3)) saturate(1.1)'
      : 'contrast(1.0) brightness(1.02) drop-shadow(0 2px 4px rgba(0,0,0,0.05)) saturate(0.95)';
    return (
      <div
        className={className}
        style={{
          width: targetW,
          height: targetH,
          overflow: 'hidden',
          position: 'relative',
          borderRadius: 6,
          filter: oldToothFilter,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={customSrc}
          alt={`Tooth ${number}`}
          draggable={false}
          style={{
            width: '100%',
            height: targetH * 2,
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
            transform: mirror ? 'scaleX(-1)' : undefined,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: targetW,
        height: targetH,
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 6,
        filter: selected ? 'drop-shadow(0 0 2px rgba(245,158,11,0.8)) saturate(1.05)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        width={targetW}
        height={targetH}
        style={{
          display: 'block',
          width: targetW,
          height: targetH,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
