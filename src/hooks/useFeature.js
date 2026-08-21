import { PLAN_FEATURES } from '@/api/base44Client';

export const useFeature = (feature) => {
  const clinicPlan = localStorage.getItem('clinic_plan') || 'pro';
  const features = PLAN_FEATURES[clinicPlan] || [];
  return features.includes(feature);
};
