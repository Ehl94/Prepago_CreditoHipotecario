import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Home, DollarSign, Calculator, Target } from 'lucide-react';

const MortgageInvestmentAnalyzer = () => {
  const [params, setParams] = useState({
    mortgageUF: 940,
    interestRate: 4.2,
    yearsRemaining: 22,
    propertyValueUF: 2050,
    propertyAppreciation: 2.0,
    monthlyInvestmentUSD: 650,
    usdToUF: 31,
    airbnbAnnualUF: 55,
    stockReturn: 10.0,
    horizon: 8,
    prepaymentPercent: 5,
    prepaymentFrequency: 3
  });

  const [activeTab, setActiveTab] = useState('comparison');

  const updateParam = (key, value) => {
    setParams(prev => {
      const newParams = { ...prev };
      newParams[key] = parseFloat(value) || 0;
      return newParams;
    });
  };

  const calculateMonthlyPayment = (principal, annualRate, years) => {
    if (principal <= 0 || years <= 0) return 0;
    const monthlyRate = annualRate / 100 / 12;
    const numPayments = years * 12;
    const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    return payment;
  };

  const calculateStrategy = (strategyType) => {
    const results = [];
    let remainingDebt = params.mortgageUF;
    let propertyValue = params.propertyValueUF;
    let stockPortfolio = 0;
    let monthlyPayment = calculateMonthlyPayment(remainingDebt, params.interestRate, params.yearsRemaining);
    let totalInterestPaid = 0;
    let totalStockInvested = 0;
    let yearsUntilNextPrepay = params.prepaymentFrequency;

    const monthlyInvestmentUF = params.monthlyInvestmentUSD / params.usdToUF;
    const monthlyStockReturn = params.stockReturn / 100 / 12;

    for (let year = 0; year <= params.horizon; year = year + 1) {
      if (year === 0) {
        results.push({
          year: 0,
          remainingDebt: remainingDebt,
          propertyValue: propertyValue,
          stockPortfolio: 0,
          netWorth: propertyValue - remainingDebt,
          totalInterestPaid: 0,
          monthlyPayment: monthlyPayment
        });
        continue;
      }

      let yearlyInterest = 0;
      const shouldPrepay = (strategyType === 'prepago_minimo' || strategyType === 'prepago_inteligente') && yearsUntilNextPrepay === 0 && remainingDebt > 0;

      for (let month = 1; month <= 12; month = month + 1) {
        if (remainingDebt <= 0) {
          remainingDebt = 0;
          stockPortfolio = stockPortfolio * (1 + monthlyStockReturn) + monthlyInvestmentUF + monthlyPayment;
          continue;
        }

        const monthlyInterest = remainingDebt * (params.interestRate / 100 / 12);
        const principalPayment = Math.min(monthlyPayment - monthlyInterest, remainingDebt);
        
        yearlyInterest = yearlyInterest + monthlyInterest;
        remainingDebt = Math.max(0, remainingDebt - principalPayment);

        if (strategyType === 'solo_inversion') {
          stockPortfolio = stockPortfolio * (1 + monthlyStockReturn) + monthlyInvestmentUF;
          totalStockInvested = totalStockInvested + monthlyInvestmentUF;
        } else if (strategyType === 'prepago_agresivo') {
          const toPrepay = monthlyInvestmentUF * 0.6;
          const toStock = monthlyInvestmentUF * 0.4;
          remainingDebt = Math.max(0, remainingDebt - toPrepay);
          stockPortfolio = stockPortfolio * (1 + monthlyStockReturn) + toStock;
          totalStockInvested = totalStockInvested + toStock;
        } else if (strategyType === 'prepago_minimo' || strategyType === 'prepago_inteligente') {
          stockPortfolio = stockPortfolio * (1 + monthlyStockReturn) + monthlyInvestmentUF;
          totalStockInvested = totalStockInvested + monthlyInvestmentUF;
        }
      }

      const airbnbGain = params.airbnbAnnualUF * (1 + params.stockReturn / 100);
      stockPortfolio = stockPortfolio + airbnbGain;
      totalStockInvested = totalStockInvested + params.airbnbAnnualUF;

      if (shouldPrepay && remainingDebt > 0) {
        const originalPayment = monthlyPayment;
        const prepayAmount = Math.min(params.mortgageUF * (params.prepaymentPercent / 100), remainingDebt);
        const penalty = originalPayment * 1.5 * (params.interestRate / 100);
        
        remainingDebt = Math.max(0, remainingDebt - prepayAmount);
        totalInterestPaid = totalInterestPaid + penalty;
        
        const yearsLeft = params.yearsRemaining - year;
        if (yearsLeft > 0 && remainingDebt > 0) {
          const newPayment = calculateMonthlyPayment(remainingDebt, params.interestRate, yearsLeft);
          if (strategyType === 'prepago_inteligente') {
            monthlyPayment = newPayment;
          }
        }
        
        yearsUntilNextPrepay = params.prepaymentFrequency;
      } else {
        yearsUntilNextPrepay = yearsUntilNextPrepay - 1;
      }

      totalInterestPaid = totalInterestPaid + yearlyInterest;
      propertyValue = propertyValue * (1 + params.propertyAppreciation / 100);

      results.push({
        year: year,
        remainingDebt: Math.max(0, remainingDebt),
        propertyValue: propertyValue,
        stockPortfolio: stockPortfolio,
        netWorth: propertyValue - remainingDebt + stockPortfolio,
        totalInterestPaid: totalInterestPaid,
        monthlyPayment: monthlyPayment
      });
    }

    return results;
  };

  const strategies = useMemo(() => {
    return {
      solo_inversion: calculateStrategy('solo_inversion'),
      prepago_agresivo: calculateStrategy('prepago_agresivo'),
      prepago_minimo: calculateStrategy('prepago_minimo'),
      prepago_inteligente: calculateStrategy('prepago_inteligente')
    };
  }, [params]);

  const comparisonData = useMemo(() => {
    return strategies.solo_inversion.map((item, idx) => {
      return {
        year: item.year,
        'Solo Inversión': parseFloat(item.netWorth.toFixed(2)),
        'Prepago Agresivo': parseFloat(strategies.prepago_agresivo[idx].netWorth.toFixed(2)),
        'Prepago Mínimo': parseFloat(strategies.prepago_minimo[idx].netWorth.toFixed(2)),
        'Prepago Inteligente': parseFloat(strategies.prepago_inteligente[idx].netWorth.toFixed(2))
      };
    });
  }, [strategies]);

  const debtData = useMemo(() => {
    return strategies.solo_inversion.map((item, idx) => {
      return {
        year: item.year,
        'Solo Inversión': parseFloat(item.remainingDebt.toFixed(2)),
        'Prepago Agresivo': parseFloat(strategies.prepago_agresivo[idx].remainingDebt.toFixed(2)),
        'Prepago Inteligente': parseFloat(strategies.prepago_inteligente[idx].remainingDebt.toFixed(2))
      };
    });
  }, [strategies]);

  const finalComparison = {
    solo_inversion: strategies.solo_inversion[params.horizon],
    prepago_agresivo: strategies.prepago_agresivo[params.horizon],
    prepago_minimo: strategies.prepago_minimo[params.horizon],
    prepago_inteligente: strategies.prepago_inteligente[params.horizon]
  };

  const bestStrategy = useMemo(() => {
    const values = Object.entries(finalComparison).map((entry) => {
      return {
        name: entry[0],
        netWorth: entry[1].netWorth
      };
    });
    return values.reduce((best, current) => {
      return current.netWorth > best.netWorth ? current : best;
    });
  }, [finalComparison]);

  const strategyCards = [
    { 
      id: 'solo_inversion', 
      name: 'Solo Inversión', 
      color: 'bg-emerald-500',
      description: 'Todo a bolsa'
    },
    { 
      id: 'prepago_agresivo', 
      name: 'Prepago Agresivo', 
      color: 'bg-amber-500',
      description: '60% prepago / 40% bolsa'
    },
    { 
      id: 'prepago_minimo', 
      name: 'Prepago Mínimo', 
      color: 'bg-indigo-500',
      description: 'Prepago periódico 5%'
    },
    { 
      id: 'prepago_inteligente', 
      name: 'Prepago Inteligente', 
      color: 'bg-purple-500',
      description: 'Prepago + baja cuota'
    }
  ];

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-8 mb-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <Calculator className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Analizador Patrimonial</h1>
              <p className="text-indigo-100">Optimización a {params.horizon} años</p>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-indigo-200 mb-1">Patrimonio Inicial</div>
              <div className="text-xl font-bold">{(params.propertyValueUF - params.mortgageUF).toFixed(0)} UF</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-indigo-200 mb-1">Mejor Proyección</div>
              <div className="text-xl font-bold">{bestStrategy.netWorth.toFixed(0)} UF</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-indigo-200 mb-1">Ganancia</div>
              <div className="text-xl font-bold text-green-300">+{(bestStrategy.netWorth - (params.propertyValueUF - params.mortgageUF)).toFixed(0)} UF</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-indigo-200 mb-1">Inversión Mensual</div>
              <div className="text-xl font-bold">{params.monthlyInvestmentUSD} USD</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg mb-6 p-1">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('comparison')}
              className={'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ' + (activeTab === 'comparison' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100')}
            >
              <TrendingUp className="w-4 h-4" />
              Comparación
            </button>
            <button
              onClick={() => setActiveTab('parameters')}
              className={'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ' + (activeTab === 'parameters' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100')}
            >
              <Calculator className="w-4 h-4" />
              Parámetros
            </button>
          </div>
        </div>

        {activeTab === 'comparison' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                Evolución del Patrimonio Neto
              </h3>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="year" 
                    label={{ value: 'Años', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    domain={['dataMin - 100', 'dataMax + 100']}
                    label={{ value: 'Patrimonio Neto (UF)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => value.toFixed(0)}
                  />
                  <Tooltip 
                    formatter={(value) => value.toFixed(0) + ' UF'}
                    contentStyle={{ backgroundColor: '#fff', border: '2px solid #6366f1', borderRadius: '8px', padding: '10px' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="Solo Inversión" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="Prepago Agresivo" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="Prepago Mínimo" stroke="#6366f1" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="Prepago Inteligente" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Home className="w-6 h-6 text-amber-600" />
                Evolución de la Deuda
              </h3>
              <ResponsiveContainer width="100%" height={450}>
                <AreaChart data={debtData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="year"
                    label={{ value: 'Años', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    domain={[0, 'dataMax + 50']}
                    label={{ value: 'Deuda Restante (UF)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => value.toFixed(0)}
                  />
                  <Tooltip 
                    formatter={(value) => value.toFixed(0) + ' UF'}
                    contentStyle={{ backgroundColor: '#fff', border: '2px solid #f59e0b', borderRadius: '8px', padding: '10px' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="Solo Inversión" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Prepago Agresivo" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Prepago Inteligente" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {strategyCards.map((strategy) => {
                const data = finalComparison[strategy.id];
                return (
                  <div key={strategy.id} className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-2xl transition-all">
                    <div className={strategy.color + ' text-white px-4 py-3 rounded-lg mb-4 font-bold text-center'}>
                      {strategy.name}
                    </div>
                    <p className="text-xs text-gray-600 mb-4 text-center">{strategy.description}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between border-b pb-2">
                        <span className="font-medium text-gray-600">Patrimonio:</span>
                        <span className="font-bold text-lg text-indigo-700">{data.netWorth.toFixed(0)} UF</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Propiedad:</span>
                        <span className="font-semibold">{data.propertyValue.toFixed(0)} UF</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deuda:</span>
                        <span className="font-semibold text-red-600">{data.remainingDebt.toFixed(0)} UF</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bolsa:</span>
                        <span className="font-semibold text-green-600">{data.stockPortfolio.toFixed(0)} UF</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">Intereses:</span>
                        <span className="font-semibold text-orange-600">{data.totalInterestPaid.toFixed(0)} UF</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Target className="w-6 h-6" />
                Recomendación
              </h3>
              <p className="text-lg leading-relaxed">
                Con retorno de {params.stockReturn}% en bolsa vs {params.interestRate}% de costo de deuda,
                la estrategia Prepago Inteligente maximiza patrimonio: reduces deuda gradualmente,
                bajas cuota mensual, y reinviertes el ahorro en bolsa.
              </p>
              <div className="mt-4 bg-white/20 rounded-lg p-4">
                <div className="flex justify-between">
                  <span>Patrimonio Proyectado:</span>
                  <span className="text-2xl font-bold">{bestStrategy.netWorth.toFixed(0)} UF</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'parameters' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Configuración</h2>
            
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-indigo-700 pb-2 border-b-2 border-indigo-200">
                  Hipoteca
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deuda (UF)</label>
                  <input
                    type="number"
                    value={params.mortgageUF}
                    onChange={(e) => updateParam('mortgageUF', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tasa (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.interestRate}
                    onChange={(e) => updateParam('interestRate', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Propiedad (UF)</label>
                  <input
                    type="number"
                    value={params.propertyValueUF}
                    onChange={(e) => updateParam('propertyValueUF', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plusvalía (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.propertyAppreciation}
                    onChange={(e) => updateParam('propertyAppreciation', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-indigo-700 pb-2 border-b-2 border-indigo-200">
                  Inversiones
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inversión Mensual (USD)</label>
                  <input
                    type="number"
                    value={params.monthlyInvestmentUSD}
                    onChange={(e) => updateParam('monthlyInvestmentUSD', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">USD a UF</label>
                  <input
                    type="number"
                    value={params.usdToUF}
                    onChange={(e) => updateParam('usdToUF', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Airbnb Anual (UF)</label>
                  <input
                    type="number"
                    value={params.airbnbAnnualUF}
                    onChange={(e) => updateParam('airbnbAnnualUF', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Retorno Bolsa (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.stockReturn}
                    onChange={(e) => updateParam('stockReturn', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-indigo-700 pb-2 border-b-2 border-indigo-200">
                  Estrategia
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horizonte (años)</label>
                  <input
                    type="number"
                    value={params.horizon}
                    onChange={(e) => updateParam('horizon', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prepago (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={params.prepaymentPercent}
                    onChange={(e) => updateParam('prepaymentPercent', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia (años)</label>
                  <input
                    type="number"
                    value={params.prepaymentFrequency}
                    onChange={(e) => updateParam('prepaymentFrequency', e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MortgageInvestmentAnalyzer;