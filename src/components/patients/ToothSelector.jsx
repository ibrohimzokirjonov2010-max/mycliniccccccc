import RealisticTooth from './RealisticTooth';

/**
 * ToothSelector Component
 *
 * Visual tooth selection grid for dental applications.
 * Supports single and multi-tooth selection with visual feedback.
 *
 * @param {Object} props
 * @param {Array<number>} props.selectedTeeth - Array of selected FDI tooth numbers
 * @param {Function} props.onChange - Callback when selection changes
 * @param {boolean} [props.multi=false] - Enable multi-select mode
 */
export default function ToothSelector({ selectedTeeth = [], onChange, multi = false }) {
  // FDI top row: right → left (18→11, then 21→28)
  const topRow = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  // FDI bottom row: right → left (48→41, then 31→38)
  const bottomRow = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  const handleToothClick = (toothNum) => {
    if (multi) {
      const isSelected = selectedTeeth.includes(toothNum);
      const newSelection = isSelected
        ? selectedTeeth.filter(t => t !== toothNum)
        : [...selectedTeeth, toothNum];
      onChange(newSelection);
    } else {
      onChange([toothNum]);
    }
  };

  const ToothItem = ({ toothNum }) => {
    const isSelected = selectedTeeth.includes(toothNum);
    return (
      <button
        type="button"
        onClick={() => handleToothClick(toothNum)}
        title={`Tish #${toothNum}`}
        style={{
          background: isSelected ? 'rgba(34,197,94,0.10)' : 'transparent',
          border: 'none',
          padding: '2px',
          cursor: 'pointer',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          outline: isSelected ? '2px solid #22c55e' : '2px solid transparent',
          outlineOffset: 1,
          transition: 'outline 0.15s, transform 0.15s',
          transform: isSelected ? 'scale(1.12)' : 'scale(1)',
        }}
      >
        <RealisticTooth number={toothNum} selected={isSelected} size={40} />
        <span style={{
          fontSize: 9,
          color: isSelected ? '#16a34a' : '#94a3b8',
          fontWeight: isSelected ? 700 : 400,
          lineHeight: 1,
        }}>
          {toothNum}
        </span>
      </button>
    );
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      {/* Upper jaw */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(16, 1fr)',
        gap: 2,
        padding: '8px 4px 4px',
        minWidth: 640,
      }}>
        {topRow.map(n => <ToothItem key={n} toothNum={n} />)}
      </div>

      {/* Jaw divider */}
      <div style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, #e2e8f0 20%, #e2e8f0 80%, transparent)',
        margin: '4px 8px',
      }} />

      {/* Lower jaw */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(16, 1fr)',
        gap: 2,
        padding: '4px 4px 8px',
        minWidth: 640,
      }}>
        {bottomRow.map(n => <ToothItem key={n} toothNum={n} />)}
      </div>

      {selectedTeeth.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 4 }}>
          Tanlangan: {selectedTeeth.sort((a, b) => a - b).join(', ')}
        </p>
      )}
    </div>
  );
}
