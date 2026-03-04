import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Loader2,
  AlertTriangle, Lightbulb, Target, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import useFinanceStore from '@/stores/financeStore';
import useSocket from '@/hooks/useSocket';

const PERIOD_OPTIONS = [
  { value: 3, label: '3 חודשים' },
  { value: 6, label: '6 חודשים' },
  { value: 12, label: 'שנה' },
];

export default function FinanceAnalyticsPage() {
  useSocket();
  const {
    analytics, analyticsLoading, fetchAnalytics,
    insights, fetchInsights,
    recommendations, fetchRecommendations,
    setupSocketListeners, cleanupSocketListeners,
  } = useFinanceStore();

  const [period, setPeriod] = useState(6);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalytics(period);
    fetchInsights();
    fetchRecommendations();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, [period]);

  if (analyticsLoading && !analytics) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const data = analytics || {};
  const summary = data.summary || {};
  const trends = data.trends || { monthlyData: [] };
  const topCategories = data.topCategories || [];
  const anomalies = data.anomalies || [];
  const predictions = data.predictions || {};

  const maxMonthlyVal = Math.max(...(trends.monthlyData || []).map(m => Math.max(m.income, m.expenses)), 1);

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold">ניתוח חכם</h1>
          <div className="flex gap-2 mt-3">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === opt.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-100'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 mt-3 bg-white rounded-xl p-1 border border-gray-100">
            {[
              { key: 'overview', label: 'סקירה' },
              { key: 'insights', label: 'תובנות' },
              { key: 'recommendations', label: 'המלצות' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 space-y-4">
        {activeTab === 'overview' && (
          <>
            {/* Efficiency score */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-blue-100">ציון יעילות פיננסית</p>
                <BarChart3 size={18} className="text-blue-200" />
              </div>
              <p className="text-5xl font-bold mb-1">{data.efficiencyScore || 0}</p>
              <p className="text-sm text-blue-100">מתוך 100</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'הכנסות', value: summary.totalIncome || 0, color: 'green', icon: TrendingUp },
                { label: 'הוצאות', value: summary.totalExpenses || 0, color: 'red', icon: TrendingDown },
                { label: 'יתרה נטו', value: summary.net || 0, color: (summary.net || 0) >= 0 ? 'green' : 'red', icon: Target },
                { label: 'שיעור חיסכון', value: `${summary.savingsRate || 0}%`, color: 'blue', icon: BarChart3, isText: true },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <card.icon size={14} className={`text-${card.color}-500`} />
                    <span className="text-xs text-gray-400">{card.label}</span>
                  </div>
                  <p className={`text-lg font-bold text-${card.color}-600`}>
                    {card.isText ? card.value : `₪${card.value.toLocaleString()}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Trends chart */}
            {trends.monthlyData?.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">מגמות חודשיות</h3>
                <div className="flex items-end gap-1.5 h-32">
                  {trends.monthlyData.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex gap-0.5 w-full items-end justify-center h-24">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(m.income / maxMonthlyVal) * 100}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                          className="w-3 bg-green-400 rounded-t-sm"
                        />
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(m.expenses / maxMonthlyVal) * 100}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                          className="w-3 bg-red-400 rounded-t-sm"
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{m.label}</span>
                    </div>
                  ))}
                </div>
                {trends.expenseTrend !== 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    {trends.expenseTrend > 0
                      ? <><ArrowUpRight size={12} className="text-red-500" /> עלייה של {trends.expenseTrend}% בהוצאות</>
                      : <><ArrowDownRight size={12} className="text-green-500" /> ירידה של {Math.abs(trends.expenseTrend)}% בהוצאות</>}
                  </div>
                )}
              </div>
            )}

            {/* Top categories */}
            {topCategories.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">קטגוריות מובילות</h3>
                <div className="space-y-2.5">
                  {topCategories.map((cat, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{cat.category}</span>
                        <span className="text-xs text-gray-500">
                          ₪{cat.total.toLocaleString()} ({cat.percent}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.percent}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                          className="h-full rounded-full bg-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anomalies */}
            {anomalies.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <AlertTriangle size={12} className="text-amber-500" /> חריגות
                </h3>
                <div className="space-y-2">
                  {anomalies.map((a, i) => (
                    <div key={i} className="flex items-center justify-between bg-amber-50 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-medium">{a.category}</p>
                        <p className="text-xs text-gray-500">ממוצע: ₪{a.average?.toLocaleString()}</p>
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-bold ${a.direction === 'עלייה' ? 'text-red-600' : 'text-green-600'}`}>
                          {a.direction === 'עלייה' ? '+' : ''}{a.deviation}%
                        </p>
                        <p className="text-xs text-gray-500">₪{a.currentMonth?.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Predictions */}
            {predictions.predictedExpenses > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">תחזית</h3>
                <p className="text-lg font-bold">₪{predictions.predictedExpenses?.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  הוצאות צפויות · מגמה {predictions.trend} · ביטחון {predictions.confidence === 'high' ? 'גבוה' : predictions.confidence === 'medium' ? 'בינוני' : 'נמוך'}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-3">
            {insights.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Lightbulb size={48} className="mx-auto mb-3 text-gray-300" />
                <p>אין מספיק נתונים לתובנות</p>
              </div>
            ) : (
              insights.map((insight, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  <p className="text-sm font-bold mb-1">{insight.title}</p>
                  <p className="text-sm text-gray-600">{insight.description}</p>
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Target size={48} className="mx-auto mb-3 text-gray-300" />
                <p>אין המלצות כרגע</p>
              </div>
            ) : (
              recommendations.map((rec, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl p-4 shadow-sm border ${
                    rec.priority === 'high' ? 'bg-red-50 border-red-100' :
                    rec.priority === 'medium' ? 'bg-amber-50 border-amber-100' :
                    'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {rec.priority === 'high' ? 'חשוב' : rec.priority === 'medium' ? 'בינוני' : 'טיפ'}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{rec.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
                      {rec.action && <p className="text-xs text-blue-600 font-medium mt-2">{rec.action}</p>}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
