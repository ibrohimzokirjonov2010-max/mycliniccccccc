import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

/**
 * Realistic Dental Chart V2
 * FDI notation with individual tooth services
 */
export default function DentalChartV2({ 
  selectedTeeth = [], 
  onToothSelect,
  toothServices = {},
  onServiceToggle,
  services = []
}) {
  const [expandedTooth, setExpandedTooth] = useState(null);

  // FDI tooth numbers
  const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  // Tooth types for anatomical shapes - different for upper and lower
  const getToothType = (number) => {
    const n = parseInt(number);
    const isUpper = n < 30;
    
    // Upper teeth
    if (isUpper) {
      // Upper Molars (8,7,6) - 3 roots
      if ([18,17,16,26,27,28].includes(n)) return 'upperMolar';
      // Upper Premolars (4,5) - 2 roots
      if ([14,15,24,25].includes(n)) return 'upperPremolar';
      // Upper Canines (3) - 1 long root
      if ([13,23].includes(n)) return 'upperCanine';
      // Upper Incisors (1,2) - 1 root, shovel-shaped
      if ([11,12,21,22].includes(n)) return 'upperIncisor';
    }
    // Lower teeth
    else {
      // Lower Molars (8,7,6) - 2 roots
      if ([38,37,36,46,47,48].includes(n)) return 'lowerMolar';
      // Lower Premolars (4,5) - 1 root
      if ([34,35,44,45].includes(n)) return 'lowerPremolar';
      // Lower Canines (3) - 1 root
      if ([33,43].includes(n)) return 'lowerCanine';
      // Lower Incisors (1,2) - 1 root, narrow
      if ([31,32,41,42].includes(n)) return 'lowerIncisor';
    }
    return 'upperMolar';
  };

  // Professional modern tooth SVG components (like your image)
  const ToothSVG = ({ type, isSelected, hasServices }) => {
    const color = isSelected ? '#10b981' : hasServices ? '#3b82f6' : '#94a3b8';
    const fillColor = isSelected ? '#10b981' : hasServices ? '#3b82f6' : '#f1f5f9';
    
    // Modern tooth shapes - smooth, rounded, professional
    const shapes = {
      // Molar - wide crown with 3 roots
      upperMolar: (
        <g>
          {/* Crown */}
          <path d="M5,4 Q5,2 8,2 L22,2 Q25,2 25,4 L26,12 Q26,16 24,18 Q22,20 15,20 Q8,20 6,18 Q4,16 4,12 Z" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          {/* Fissures */}
          <path d="M10,8 Q12,12 15,10 Q18,12 20,8" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M12,14 Q15,16 18,14" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          {/* Roots */}
          <path d="M8,20 L7,32 Q7,34 9,34 L11,34 Q13,34 13,32 L12,20" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M13,20 L14,32 Q14,34 16,34 L18,34 Q20,34 20,32 L19,20" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M19,20 L20,32 Q20,34 22,34 L24,34 Q26,34 26,32 L25,20" fill={fillColor} stroke={color} strokeWidth="1.5"/>
        </g>
      ),
      lowerMolar: (
        <g>
          <path d="M5,4 Q5,2 8,2 L22,2 Q25,2 25,4 L26,12 Q26,16 24,18 Q22,20 15,20 Q8,20 6,18 Q4,16 4,12 Z" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M10,8 Q12,12 15,10 Q18,12 20,8" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M12,14 Q15,16 18,14" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M9,20 L8,32 Q8,34 10,34 L13,34 Q15,34 15,32 L14,20" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M17,20 L18,32 Q18,34 21,34 L24,34 Q26,34 26,32 L25,20" fill={fillColor} stroke={color} strokeWidth="1.5"/>
        </g>
      ),
      // Premolar - 2 cusps, 2 roots
      upperPremolar: (
        <g>
          <path d="M7,4 Q7,2 10,2 L20,2 Q23,2 23,4 L24,12 Q24,16 22,18 Q20,20 15,20 Q10,20 8,18 Q6,16 6,12 Z" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M11,8 Q13,12 15,10 Q17,12 19,8" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M10,20 L9,32 Q9,34 11,34 L13,34 Q15,34 15,32 L14,20" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M16,20 L17,32 Q17,34 19,34 L21,34 Q23,34 23,32 L22,20" fill={fillColor} stroke={color} strokeWidth="1.5"/>
        </g>
      ),
      lowerPremolar: (
        <g>
          <path d="M7,4 Q7,2 10,2 L20,2 Q23,2 23,4 L24,12 Q24,16 22,18 Q20,20 15,20 Q10,20 8,18 Q6,16 6,12 Z" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M11,8 Q13,12 15,10 Q17,12 19,8" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M12,20 L11,32 Q11,34 13,34 L17,34 Q19,34 19,32 L18,20" fill={fillColor} stroke={color} strokeWidth="1.5"/>
        </g>
      ),
      // Canine - pointed, 1 long root
      upperCanine: (
        <g>
          <path d="M10,3 Q10,2 12,2 L18,2 Q20,2 20,3 L22,12 Q22,18 19,21 Q17,23 15,23 Q13,23 11,21 Q8,18 8,12 Z" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M12,10 Q14,15 15,15 Q16,15 18,10" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M12,23 L11,35 Q11,37 13,37 L17,37 Q19,37 19,35 L18,23" fill={fillColor} stroke={color} strokeWidth="1.5"/>
        </g>
      ),
      lowerCanine: (
        <g>
          <path d="M10,3 Q10,2 12,2 L18,2 Q20,2 20,3 L22,12 Q22,18 19,21 Q17,23 15,23 Q13,23 11,21 Q8,18 8,12 Z" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M12,10 Q14,15 15,15 Q16,15 18,10" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M12,23 L11,35 Q11,37 13,37 L17,37 Q19,37 19,35 L18,23" fill={fillColor} stroke={color} strokeWidth="1.5"/>
        </g>
      ),
      // Incisor - flat, shovel-shaped
      upperIncisor: (
        <g>
          <path d="M9,3 Q9,2 11,2 L19,2 Q21,2 21,3 L23,12 Q23,18 21,21 Q19,23 15,23 Q11,23 9,21 Q7,18 7,12 Z" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M11,12 Q13,17 15,17 Q17,17 19,12" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M11,23 L10,35 Q10,37 12,37 L18,37 Q20,37 20,35 L19,23" fill={fillColor} stroke={color} strokeWidth="1.5"/>
        </g>
      ),
      lowerIncisor: (
        <g>
          <path d="M10,4 Q10,3 12,3 L18,3 Q20,3 20,4 L22,13 Q22,19 20,22 Q18,24 15,24 Q12,24 10,22 Q8,19 8,13 Z" fill={fillColor} stroke={color} strokeWidth="1.5"/>
          <path d="M12,13 Q14,18 15,18 Q16,18 18,13" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
          <path d="M12,24 L11,35 Q11,37 13,37 L17,37 Q19,37 19,35 L18,24" fill={fillColor} stroke={color} strokeWidth="1.5"/>
        </g>
      )
    };
    
    return shapes[type] || shapes.upperMolar;
  };

  const Tooth = ({ number, isUpper }) => {
    const isSelected = selectedTeeth.includes(number);
    const toothType = getToothType(number);
    const hasServices = toothServices[number] && toothServices[number].length > 0;
    
    return (
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => onToothSelect(number)}
        className={`relative flex flex-col items-center p-2 rounded-xl transition-all ${
          isSelected 
            ? 'bg-emerald-100 shadow-lg shadow-emerald-200 border-2 border-emerald-500' 
            : hasServices
            ? 'bg-blue-50 shadow-md shadow-blue-200 border-2 border-blue-400'
            : 'bg-white hover:bg-slate-50 border border-slate-200'
        }`}
      >
        {/* Professional Tooth SVG */}
        <svg 
          viewBox="0 0 30 40" 
          className="w-14 h-16"
        >
          <ToothSVG type={toothType} isSelected={isSelected} hasServices={hasServices} />
        </svg>
        
        {/* Tooth Number - FDI style */}
        <span className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
          isSelected 
            ? 'bg-emerald-500 text-white' 
            : hasServices
            ? 'bg-blue-500 text-white'
            : 'bg-slate-200 text-slate-600'
        }`}>
          {number}
        </span>
        
        {/* Service indicator badge */}
        {hasServices && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm">
            {toothServices[number].length}
          </span>
        )}
      </motion.button>
    );
  };

  // Toggle service for a tooth
  const toggleService = (toothNumber, serviceId) => {
    const currentServices = toothServices[toothNumber] || [];
    const newServices = currentServices.includes(serviceId)
      ? currentServices.filter(id => id !== serviceId)
      : [...currentServices, serviceId];
    
    onServiceToggle(toothNumber, newServices);
  };

  // Calculate total for a tooth
  const getToothTotal = (toothNumber) => {
    const servicesList = toothServices[toothNumber] || [];
    return servicesList.reduce((sum, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return sum + (service?.price || 0);
    }, 0);
  };

  // Get selected services for a tooth
  const getSelectedServicesForTooth = (toothNumber) => {
    const serviceIds = toothServices[toothNumber] || [];
    return serviceIds.map(id => services.find(s => s.id === id)).filter(Boolean);
  };

  return (
    <div className="space-y-6">
      {/* Dental Chart */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">
          Tish tanlang 
          <span className="text-sm font-normal text-slate-500 ml-2">
            ({selectedTeeth.length} ta tish tanlandi)
          </span>
        </h3>

        
        {/* Upper Jaw */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center mb-3">
            Yuqori jag'
          </p>
          <div className="px-2">
            <div className="flex justify-center gap-1 min-w-max pb-2">
              {upperTeeth.map(num => (
                <Tooth key={num} number={num} isUpper={true} />
              ))}
            </div>
          </div>
        </div>
        
        {/* Divider */}
        <div className="h-px bg-slate-200 my-4" />
        
        {/* Lower Jaw */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center mb-3">
            Quyi jag'
          </p>
          <div className="overflow-x-auto teeth-slider px-2">
            <div className="flex justify-center gap-1 min-w-max pb-2">
              {lowerTeeth.map(num => (
                <Tooth key={num} number={num} isUpper={false} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Teeth Services */}
      {selectedTeeth.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">
            Har bir tishga xizmatlar
          </h3>
          
          {selectedTeeth.map(toothNumber => (
            <motion.div
              key={toothNumber}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
              {/* Tooth Header */}
              <button
                onClick={() => setExpandedTooth(expandedTooth === toothNumber ? null : toothNumber)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <span className="text-lg font-bold text-emerald-700">{toothNumber}</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900">Tish #{toothNumber}</p>
                    <p className="text-sm text-slate-500">
                      {getSelectedServicesForTooth(toothNumber).map(s => s.name).join(', ') || 'Xizmat tanlanmagan'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-emerald-600">
                    {formatCurrency(getToothTotal(toothNumber))}
                  </span>
                  {expandedTooth === toothNumber ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>
              
              {/* Services List */}
              <AnimatePresence>
                {expandedTooth === toothNumber && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-100"
                  >
                    <div className="p-4 space-y-2">
                      {services.filter(service => {
                        if (!service.requires_tooth) return true;
                        const allowed = Array.isArray(service.tooth_numbers) ? service.tooth_numbers.map(Number) : [];
                        if (allowed.length === 0) return true;
                        return allowed.includes(Number(toothNumber));
                      }).map(service => {
                        const isSelected = (toothServices[toothNumber] || []).includes(service.id);
                        return (
                          <button
                            key={service.id}
                            onClick={() => toggleService(toothNumber, service.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                              isSelected 
                                ? 'bg-emerald-50 border border-emerald-200' 
                                : 'bg-slate-50 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected 
                                  ? 'bg-emerald-500 border-emerald-500' 
                                  : 'border-slate-300'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className={`font-medium ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>
                                {service.name}
                              </span>
                            </div>
                            <span className={`font-bold ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {formatCurrency(service.price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
          
          {/* Grand Total */}
          <div className="bg-slate-900 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Jami summa</span>
              <span className="text-2xl font-bold text-white">
                {formatCurrency(
                  selectedTeeth.reduce((sum, tooth) => sum + getToothTotal(tooth), 0)
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
