'use client'

import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

export default function ImbalanceImpactAnalyzer() {
  // Input state values
  const [numSellers, setNumSellers] = useState(40);
  const [avgDealsPerRep, setAvgDealsPerRep] = useState(20);
  const [avgDealSize, setAvgDealSize] = useState(50000);
  const [avgQuotaPerRep, setAvgQuotaPerRep] = useState(1000000);
  const [namedAccounts, setNamedAccounts] = useState(2000);
  const [overassignedReps, setOverassignedReps] = useState(10);
  const [underassignedReps, setUnderassignedReps] = useState(20);
  
  // Percentage sliders
  const [accountsNotWorked, setAccountsNotWorked] = useState(5);
  const [conversionRate, setConversionRate] = useState(10);
  const [quotaInefficiency, setQuotaInefficiency] = useState(15);
  const [planAttainmentImbalance, setPlanAttainmentImbalance] = useState(8);
  
  // Calculated results
  const [revenueLost, setRevenueLost] = useState(0);
  const [quotaVariance, setQuotaVariance] = useState(0);
  const [totalImpact, setTotalImpact] = useState(0);

  // Calculate impacts when inputs change
  useEffect(() => {
    // Calculate Revenue Lost to Territory Imbalance
    const imbalancedAccounts = namedAccounts * (accountsNotWorked / 100);
    const potentialDeals = imbalancedAccounts * (conversionRate / 100);
    const revLost = potentialDeals * avgDealSize;
    setRevenueLost(revLost);

    // Calculate Quota Variance Impact
    const totalQuota = avgQuotaPerRep * numSellers;
    const inefficientQuota = totalQuota * (quotaInefficiency / 100);
    const attainmentLoss = inefficientQuota * (planAttainmentImbalance / 100);
    setQuotaVariance(attainmentLoss);
    
    // Total Impact
    setTotalImpact(revLost + attainmentLoss);
  }, [
    numSellers, avgDealsPerRep, avgDealSize, avgQuotaPerRep, 
    namedAccounts, overassignedReps, underassignedReps,
    accountsNotWorked, conversionRate, quotaInefficiency, planAttainmentImbalance
  ]);

  // Format numbers with commas
  const formatNumber = (num) => {
    return num.toLocaleString('en-US', {
      maximumFractionDigits: 0
    });
  };

  // Format currency
  const formatCurrency = (num) => {
    return `$${formatNumber(num)}`;
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto bg-gray-100 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-blue-900 text-white p-6 text-center">
        <h1 className="text-4xl font-bold mb-2">Imbalance Impact Analyzer</h1>
        <h2 className="text-xl">Unique tool to diagnose and quantify GTM misalignment.</h2>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8 p-8">
        {/* Left column - inputs */}
        <div className="space-y-6">
          <div className="grid grid-cols-3 items-center">
            <label className="text-lg font-semibold col-span-2">Number of Sellers</label>
            <input
              type="number"
              className="p-2 border rounded text-right"
              value={numSellers}
              onChange={(e) => setNumSellers(Number(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-3 items-center">
            <label className="text-lg font-semibold col-span-2">Avg. Deals Closed per Rep Annually</label>
            <input
              type="number"
              className="p-2 border rounded text-right"
              value={avgDealsPerRep}
              onChange={(e) => setAvgDealsPerRep(Number(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-3 items-center">
            <label className="text-lg font-semibold col-span-2">Average Deal Size ($)</label>
            <input
              type="number"
              className="p-2 border rounded text-right"
              value={avgDealSize}
              onChange={(e) => setAvgDealSize(Number(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-3 items-center">
            <label className="text-lg font-semibold col-span-2">Average Quota per Rep</label>
            <input
              type="number"
              className="p-2 border rounded text-right"
              value={avgQuotaPerRep}
              onChange={(e) => setAvgQuotaPerRep(Number(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-3 items-center">
            <label className="text-lg font-semibold col-span-2"># Named or Assigned Accounts</label>
            <input
              type="number"
              className="p-2 border rounded text-right"
              value={namedAccounts}
              onChange={(e) => setNamedAccounts(Number(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-3 items-center">
            <label className="text-lg font-semibold col-span-2"># of Overassigned Reps</label>
            <input
              type="number"
              className="p-2 border rounded text-right"
              value={overassignedReps}
              onChange={(e) => setOverassignedReps(Number(e.target.value))}
            />
          </div>
          
          <div className="grid grid-cols-3 items-center">
            <label className="text-lg font-semibold col-span-2"># of Underassigned Reps</label>
            <input
              type="number"
              className="p-2 border rounded text-right"
              value={underassignedReps}
              onChange={(e) => setUnderassignedReps(Number(e.target.value))}
            />
          </div>
          
          <div className="mt-10 border-t pt-6">
            <div className="flex items-center mb-4">
              <h3 className="text-lg font-semibold">Est. Revenue Lost to Territory Imbalance</h3>
              <div className="ml-2 text-blue-500">
                <Info size={20} />
              </div>
              <div className="ml-auto text-3xl font-bold text-red-600">
                {formatCurrency(revenueLost)}
              </div>
            </div>
            
            <div className="flex items-center mb-4">
              <h3 className="text-lg font-semibold">Quota Variance Impact</h3>
              <div className="ml-2 text-blue-500">
                <Info size={20} />
              </div>
              <div className="ml-auto text-3xl font-bold text-red-600">
                {formatCurrency(quotaVariance)}
              </div>
            </div>
            
            <div className="flex items-center pt-2 border-t">
              <h3 className="text-lg font-semibold">Total Est. Impact from Territory and Quota Issues</h3>
              <div className="ml-2 text-blue-500">
                <Info size={20} />
              </div>
              <div className="ml-auto text-3xl font-bold text-red-600">
                {formatCurrency(totalImpact)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right column - sliders */}
        <div className="space-y-12">
          <div>
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-semibold">% of Accounts not Worked</h3>
              <div className="ml-2 text-blue-500">
                <Info size={20} />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={accountsNotWorked}
                onChange={(e) => setAccountsNotWorked(Number(e.target.value))}
                className="w-full"
              />
              <input
                type="number"
                className="ml-4 p-2 border rounded w-16 text-right"
                value={accountsNotWorked}
                onChange={(e) => setAccountsNotWorked(Number(e.target.value))}
              />
              <span className="ml-1">%</span>
            </div>
          </div>
          
          <div>
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-semibold">% Close/conversion rate on new logo accounts</h3>
              <div className="ml-2 text-blue-500">
                <Info size={20} />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={conversionRate}
                onChange={(e) => setConversionRate(Number(e.target.value))}
                className="w-full"
              />
              <input
                type="number"
                className="ml-4 p-2 border rounded w-16 text-right"
                value={conversionRate}
                onChange={(e) => setConversionRate(Number(e.target.value))}
              />
              <span className="ml-1">%</span>
            </div>
          </div>
          
          <div>
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-semibold">Est Quota Inefficiency: Under/Over-assignment</h3>
              <div className="ml-2 text-blue-500">
                <Info size={20} />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={quotaInefficiency}
                onChange={(e) => setQuotaInefficiency(Number(e.target.value))}
                className="w-full"
              />
              <input
                type="number"
                className="ml-4 p-2 border rounded w-16 text-right"
                value={quotaInefficiency}
                onChange={(e) => setQuotaInefficiency(Number(e.target.value))}
              />
              <span className="ml-1">%</span>
            </div>
          </div>
          
          <div>
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-semibold">Plan Attainment Imbalance (%)</h3>
              <div className="ml-2 text-blue-500">
                <Info size={20} />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={planAttainmentImbalance}
                onChange={(e) => setPlanAttainmentImbalance(Number(e.target.value))}
                className="w-full"
              />
              <input
                type="number"
                className="ml-4 p-2 border rounded w-16 text-right"
                value={planAttainmentImbalance}
                onChange={(e) => setPlanAttainmentImbalance(Number(e.target.value))}
              />
              <span className="ml-1">%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}