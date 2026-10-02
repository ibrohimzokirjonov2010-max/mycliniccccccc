import { useEffect, useState } from 'react';
import { planAllows, readClinicPlan, subscribeClinicPlan } from '@/lib/clinicPlan';

export function useClinicPlan() {
  const [plan, setPlan] = useState(readClinicPlan);
  useEffect(() => subscribeClinicPlan(setPlan), []);
  return plan;
}

export const useFeature = (feature) => {
  const plan = useClinicPlan();
  return planAllows(plan, feature);
};
