'use client';

import { createContext, useContext, useState } from 'react';

const ActivationContext = createContext();

export const useActivation = () => {
  const context = useContext(ActivationContext);
  if (!context) {
    throw new Error('useActivation must be used within ActivationProvider');
  }
  return context;
};

export const ActivationProvider = ({ children }) => {
  // Global state for Activation Accounting
  const [reinvestmentPct, setReinvestmentPct] = useState(0.15);
  const [utilizationPct, setUtilizationPct] = useState(0.7);
  const [revenue, setRevenue] = useState(500000);
  const [prevRevenue, setPrevRevenue] = useState(400000);
  
  // Target revenue planning
  const [annualTarget, setAnnualTarget] = useState(1000000);
  const [avgDeal, setAvgDeal] = useState(25000);
  const [winRate, setWinRate] = useState(0.25);
  const [cycleDays, setCycleDays] = useState(60);
  
  // BD Goals
  const [goalAnnual, setGoalAnnual] = useState(1200000);
  const [goalQuarter, setGoalQuarter] = useState(300000);

  const value = {
    reinvestmentPct,
    setReinvestmentPct,
    utilizationPct,
    setUtilizationPct,
    revenue,
    setRevenue,
    prevRevenue,
    setPrevRevenue,
    annualTarget,
    setAnnualTarget,
    avgDeal,
    setAvgDeal,
    winRate,
    setWinRate,
    cycleDays,
    setCycleDays,
    goalAnnual,
    setGoalAnnual,
    goalQuarter,
    setGoalQuarter
  };

  return (
    <ActivationContext.Provider value={value}>
      {children}
    </ActivationContext.Provider>
  );
};

