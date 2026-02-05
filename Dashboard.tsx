import React, { useState, useMemo, useEffect } from 'react';
import { Upload, AlertTriangle, TrendingDown, TrendingUp, DollarSign, Zap, Filter, Calendar, Download, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

// Demo data generator - creates realistic power market data
const generateDemoData = () => {
  const projects = [
    { name: 'West Texas Solar 1', iso: 'ERCOT', capacity: 50, offtake: 0.75, price: 28.50, type: 'as-gen' },
    { name: 'West Texas Solar 2', iso: 'ERCOT', capacity: 75, offtake: 0.85, price: 29.20, type: 'as-gen' },
    { name: 'Panhandle Solar A', iso: 'ERCOT', capacity: 100, offtake: 0.80, price: 27.80, type: 'fixed-shape' },
    { name: 'Austin Solar Farm', iso: 'ERCOT', capacity: 60, offtake: 0.70, price: 30.10, type: 'proxy-gen' },
    { name: 'Illinois Solar Farm A', iso: 'PJM', capacity: 75, offtake: 0.90, price: 35.40, type: 'as-gen' },
    { name: 'Indiana Solar Phase 2', iso: 'MISO', capacity: 100, offtake: 0.88, price: 32.60, type: 'as-gen' },
    { name: 'Ohio Solar Complex', iso: 'PJM', capacity: 85, offtake: 0.92, price: 34.80, type: 'as-gen' }
  ];

  const data = [];
  const startDate = new Date('2026-01-01');
  const days = 59; // Jan + Feb

  for (let day = 0; day < days; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);
    const dateStr = currentDate.toISOString().split('T')[0];

    projects.forEach(proj => {
      // Base generation
      const baseCF = 0.25 + Math.random() * 0.05;
      const actualGen = proj.capacity * baseCF * 10; // ~10 hours solar
      const budgetGen = actualGen * (1.02 + Math.random() * 0.03);

      const omCost = (proj.capacity * 15000) / 365;
      const marketingCost = (proj.capacity * 5000) / 365;

      let row = {
        date: dateStr,
        project_name: proj.name,
        iso: proj.iso,
        project_type: proj.type,
        capacity_mw: proj.capacity,
        offtake_pct: proj.offtake,
        contracted_price: proj.price,
        actual_gen_mwh: actualGen,
        budget_gen_mwh: budgetGen,
        gen_vs_budget_pct: ((actualGen - budgetGen) / budgetGen * 100),
        curtailed_mwh: 0,
        om_cost: omCost,
        marketing_cost: marketingCost,
        weather_event: Math.random() < 0.05 ? 'Winter Storm' : 'Normal'
      };

      if (proj.iso === 'ERCOT') {
        const rtHub = 25 + Math.random() * 10;
        const basisSpread = Math.random() < 0.15 ? (0.5 + Math.random() * 1.5) : (2.5 + Math.random() * 3.5);
        const rtNode = rtHub + basisSpread;

        const ppaRevenue = actualGen * proj.offtake * proj.price;
        const merchantRevenue = actualGen * rtNode;
        const buybackCost = (actualGen * proj.offtake) * rtHub;
        const basisRevenue = merchantRevenue - buybackCost;

        let dartCost = 0;
        let proxyCost = 0;

        if (proj.type === 'fixed-shape') {
          const fixedShape = proj.capacity * baseCF * 10 * 24;
          const shortfall = Math.max(0, fixedShape - actualGen);
          if (shortfall > 0) dartCost = shortfall * rtNode * 1.05;
          row.fixed_shape_shortfall_mwh = shortfall;
        }

        if (proj.type === 'proxy-gen') {
          const proxyGen = actualGen * (1.0 + (Math.random() - 0.5) * 0.1);
          const variance = actualGen - proxyGen;
          if (variance < 0) proxyCost = Math.abs(variance) * rtNode;
          row.proxy_gen_mwh = proxyGen;
          row.proxy_variance_mwh = variance;
        }

        row.rt_node_avg = rtNode;
        row.rt_hub_avg = rtHub;
        row.basis_spread = basisSpread;
        row.ppa_revenue = ppaRevenue;
        row.basis_revenue = basisRevenue;
        row.dart_buyback_cost = dartCost;
        row.proxy_buyback_cost = proxyCost;
        row.total_revenue = ppaRevenue + basisRevenue - dartCost - proxyCost;
        row.total_costs = omCost + marketingCost;
        row.net_pl = row.total_revenue - row.total_costs;
      } else {
        // PJM/MISO
        const daHub = 30 + Math.random() * 8;
        const daNode = daHub + (2 + Math.random() * 2);
        const daSchedule = actualGen * (1.0 + (Math.random() - 0.5) * 0.16);
        const imbalance = actualGen - daSchedule;
        const rtNode = daNode * (1.0 + (Math.random() - 0.5) * 0.35);

        const daRevenue = daSchedule * daHub;
        const daBasisRevenue = daSchedule * (daNode - daHub);
        const ppaRevenue = actualGen * proj.offtake * proj.price;

        let imbalanceCost = 0;
        let imbalanceRevenue = 0;

        if (imbalance < 0) {
          imbalanceCost = Math.abs(imbalance) * rtNode;
        } else {
          imbalanceRevenue = imbalance * rtNode;
        }

        row.da_node_avg = daNode;
        row.da_hub_avg = daHub;
        row.da_schedule_mwh = daSchedule;
        row.imbalance_mwh = imbalance;
        row.ppa_revenue = ppaRevenue;
        row.da_revenue = daRevenue;
        row.da_basis_revenue = daBasisRevenue;
        row.imbalance_cost = imbalanceCost;
        row.imbalance_revenue = imbalanceRevenue;
        row.total_revenue = ppaRevenue + daRevenue + daBasisRevenue + imbalanceRevenue - imbalanceCost;
        row.total_costs = omCost + marketingCost;
        row.net_pl = row.total_revenue - row.total_costs;
      }

      data.push(row);
    });
  }

  return data;
};

const PowerMarketDashboard = () => {
  const [csvData, setCsvData] = useState([]);
  const [selectedISO, setSelectedISO] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [viewMode, setViewMode] = useState('summary');

  // Load demo data on mount
  useEffect(() => {
    const demoData = generateDemoData();
    setCsvData(demoData);
    if (demoData.length > 0) {
      setDateRange({
        start: demoData[0].date,
        end: demoData[demoData.length - 1].date
      });
    }
  }, []);

  // Parse CSV upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const data = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',');
          const row = {};
          headers.forEach((header, i) => {
            const value = values[i]?.trim() || '';
            if (value && !isNaN(value) && value !== '') {
              row[header] = parseFloat(value);
            } else {
              row[header] = value;
            }
          });
          return row;
        });
      
      setCsvData(data);
      if (data.length > 0) {
        setDateRange({
          start: data[0].date,
          end: data[data.length - 1].date
        });
      }
    };
    reader.readAsText(file);
  };

  // Filter data
  const filteredData = useMemo(() => {
    let filtered = csvData;
    
    if (selectedISO !== 'ALL') {
      filtered = filtered.filter(row => row.iso === selectedISO);
    }
    
    if (selectedProject !== 'ALL') {
      filtered = filtered.filter(row => row.project_name === selectedProject);
    }
    
    return filtered;
  }, [csvData, selectedISO, selectedProject]);

  // Get unique projects and ISOs
  const uniqueProjects = useMemo(() => {
    const projects = [...new Set(csvData.map(r => r.project_name))];
    return projects.sort();
  }, [csvData]);

  const uniqueISOs = useMemo(() => {
    return [...new Set(csvData.map(r => r.iso))].sort();
  }, [csvData]);

  // Calculate risk alerts
  const riskAlerts = useMemo(() => {
    const alerts = [];
    
    filteredData.forEach(row => {
      if (row.net_pl < 0) {
        alerts.push({
          severity: 'critical',
          project: row.project_name,
          date: row.date,
          iso: row.iso,
          type: 'Negative P&L',
          metric: row.net_pl,
          message: `Loss of $${Math.abs(row.net_pl).toLocaleString(undefined, {maximumFractionDigits: 0})}`
        });
      }

      if (row.iso === 'ERCOT' && row.basis_spread < 2.0) {
        alerts.push({
          severity: 'high',
          project: row.project_name,
          date: row.date,
          iso: row.iso,
          type: 'Basis Compression',
          metric: row.basis_spread,
          message: `RT basis only $${row.basis_spread.toFixed(2)}/MWh`
        });
      }

      if ((row.iso === 'PJM' || row.iso === 'MISO') && row.imbalance_cost > 0) {
        const imbalancePercent = (row.imbalance_cost / row.da_revenue) * 100;
        if (imbalancePercent > 10) {
          alerts.push({
            severity: 'high',
            project: row.project_name,
            date: row.date,
            iso: row.iso,
            type: 'High Imbalance Cost',
            metric: row.imbalance_cost,
            message: `${imbalancePercent.toFixed(1)}% of DA revenue`
          });
        }
      }

      if ((row.iso === 'PJM' || row.iso === 'MISO') && row.da_node_avg && row.da_hub_avg) {
        const daBasis = row.da_node_avg - row.da_hub_avg;
        if (daBasis < 2.5) {
          alerts.push({
            severity: 'medium',
            project: row.project_name,
            date: row.date,
            iso: row.iso,
            type: 'DA Basis Compression',
            metric: daBasis,
            message: `DA basis only $${daBasis.toFixed(2)}/MWh`
          });
        }
      }

      if (row.gen_vs_budget_pct < -5) {
        alerts.push({
          severity: 'medium',
          project: row.project_name,
          date: row.date,
          iso: row.iso,
          type: 'Budget Miss',
          metric: row.gen_vs_budget_pct,
          message: `${Math.abs(row.gen_vs_budget_pct).toFixed(1)}% below budget`
        });
      }

      if (row.dart_buyback_cost > 0) {
        alerts.push({
          severity: 'high',
          project: row.project_name,
          date: row.date,
          iso: row.iso,
          type: 'DART Buyback',
          metric: row.dart_buyback_cost,
          message: `Fixed-shape cost $${row.dart_buyback_cost.toLocaleString(undefined, {maximumFractionDigits: 0})}`
        });
      }

      if (row.proxy_buyback_cost > 0) {
        alerts.push({
          severity: 'medium',
          project: row.project_name,
          date: row.date,
          iso: row.iso,
          type: 'Proxy Variance',
          metric: row.proxy_buyback_cost,
          message: `Proxy cost $${row.proxy_buyback_cost.toLocaleString(undefined, {maximumFractionDigits: 0})}`
        });
      }

      if (row.weather_event !== 'Normal') {
        alerts.push({
          severity: 'medium',
          project: row.project_name,
          date: row.date,
          iso: row.iso,
          type: 'Weather Event',
          metric: 0,
          message: row.weather_event
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [filteredData]);

  // Summary metrics
  const summary = useMemo(() => {
    if (filteredData.length === 0) return null;

    const byISO = {};
    filteredData.forEach(row => {
      if (!byISO[row.iso]) {
        byISO[row.iso] = {
          revenue: 0,
          costs: 0,
          margin: 0,
          actualGen: 0,
          budgetGen: 0,
          basisRevenue: 0,
          imbalanceCost: 0
        };
      }
      byISO[row.iso].revenue += row.total_revenue || 0;
      byISO[row.iso].costs += row.total_costs || 0;
      byISO[row.iso].margin += row.net_pl || 0;
      byISO[row.iso].actualGen += row.actual_gen_mwh || 0;
      byISO[row.iso].budgetGen += row.budget_gen_mwh || 0;
      byISO[row.iso].basisRevenue += (row.basis_revenue || row.da_basis_revenue || 0);
      byISO[row.iso].imbalanceCost += (row.imbalance_cost || 0);
    });

    const total = {
      revenue: filteredData.reduce((sum, r) => sum + (r.total_revenue || 0), 0),
      costs: filteredData.reduce((sum, r) => sum + (r.total_costs || 0), 0),
      margin: filteredData.reduce((sum, r) => sum + (r.net_pl || 0), 0),
      actualGen: filteredData.reduce((sum, r) => sum + (r.actual_gen_mwh || 0), 0),
      budgetGen: filteredData.reduce((sum, r) => sum + (r.budget_gen_mwh || 0), 0)
    };

    return { byISO, total };
  }, [filteredData]);

  // Budget performance by project
  const budgetPerformance = useMemo(() => {
    const byProject = {};
    filteredData.forEach(row => {
      if (!byProject[row.project_name]) {
        byProject[row.project_name] = {
          iso: row.iso,
          actualGen: 0,
          budgetGen: 0,
          actualRevenue: 0,
          days: 0
        };
      }
      byProject[row.project_name].actualGen += row.actual_gen_mwh || 0;
      byProject[row.project_name].budgetGen += row.budget_gen_mwh || 0;
      byProject[row.project_name].actualRevenue += row.total_revenue || 0;
      byProject[row.project_name].days++;
    });

    return Object.entries(byProject).map(([name, data]) => ({
      name,
      ...data,
      genVariance: ((data.actualGen - data.budgetGen) / data.budgetGen * 100),
      avgDailyRevenue: data.actualRevenue / data.days
    })).sort((a, b) => a.genVariance - b.genVariance);
  }, [filteredData]);

  // Chart data
  const dailyPLChart = useMemo(() => {
    const byDate = {};
    filteredData.forEach(row => {
      if (!byDate[row.date]) {
        byDate[row.date] = { date: row.date, revenue: 0, costs: 0, margin: 0 };
      }
      byDate[row.date].revenue += row.total_revenue || 0;
      byDate[row.date].costs += row.total_costs || 0;
      byDate[row.date].margin += row.net_pl || 0;
    });

    return Object.values(byDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => ({
        ...d,
        revenue: Math.round(d.revenue),
        costs: Math.round(d.costs),
        margin: Math.round(d.margin)
      }));
  }, [filteredData]);

  const isoRevenueChart = useMemo(() => {
    if (!summary) return [];
    
    return Object.entries(summary.byISO).map(([iso, data]) => ({
      iso,
      'PPA Revenue': Math.round(data.revenue - data.basisRevenue),
      'Basis Revenue': Math.round(data.basisRevenue),
      'Total': Math.round(data.revenue)
    }));
  }, [summary]);

  const genBudgetChart = useMemo(() => {
    return budgetPerformance.map(proj => ({
      name: proj.name.length > 20 ? proj.name.substring(0, 20) + '...' : proj.name,
      'Actual': Math.round(proj.actualGen),
      'Budget': Math.round(proj.budgetGen),
      'Variance %': proj.genVariance
    }));
  }, [budgetPerformance]);

  if (csvData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-8">
        <div className="text-white text-center">
          <Zap className="w-16 h-16 text-amber-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold mb-2">Loading Demo Data...</h2>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'from-red-600 to-red-700';
      case 'high': return 'from-orange-500 to-orange-600';
      case 'medium': return 'from-amber-500 to-amber-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  const getSeverityBorder = (severity) => {
    switch(severity) {
      case 'critical': return 'border-red-500';
      case 'high': return 'border-orange-500';
      case 'medium': return 'border-amber-500';
      default: return 'border-blue-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white p-6" style={{
      fontFamily: "'IBM Plex Sans', sans-serif"
    }}>
      <div className="max-w-[1800px] mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/30 blur-xl"></div>
                <Zap className="w-10 h-10 text-amber-400 relative" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight" style={{
                fontFamily: "'Space Grotesk', sans-serif"
              }}>
                Power Market Analytics
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                DEMO DATA
              </span>
            </div>
            <p className="text-zinc-400 ml-14" style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.9rem'
            }}>
              {filteredData.length} days • {uniqueProjects.length} projects • {uniqueISOs.length} ISOs
            </p>
          </div>

          <div className="flex gap-3">
            <label className="cursor-pointer">
              <div className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all flex items-center gap-2 text-sm font-medium">
                <Upload className="w-4 h-4" />
                Upload CSV
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'summary' 
                  ? 'bg-amber-500 text-zinc-950' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode('risk')}
              className={`px-4 py-2 rounded-lg font-medium transition-all relative ${
                viewMode === 'risk' 
                  ? 'bg-amber-500 text-zinc-950' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Risk Alerts
              {riskAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {riskAlerts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('projects')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'projects' 
                  ? 'bg-amber-500 text-zinc-950' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setViewMode('budgets')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'budgets' 
                  ? 'bg-amber-500 text-zinc-950' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Budget vs Actual
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur">
            <label className="text-zinc-400 text-sm mb-2 block font-medium" style={{
              fontFamily: "'IBM Plex Mono', monospace"
            }}>ISO Market</label>
            <select
              value={selectedISO}
              onChange={(e) => setSelectedISO(e.target.value)}
              className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-amber-500 focus:outline-none transition-colors"
              style={{
                fontFamily: "'IBM Plex Mono', monospace"
              }}
            >
              <option value="ALL">All Markets</option>
              {uniqueISOs.map(iso => (
                <option key={iso} value={iso}>{iso}</option>
              ))}
            </select>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur">
            <label className="text-zinc-400 text-sm mb-2 block font-medium" style={{
              fontFamily: "'IBM Plex Mono', monospace"
            }}>Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-amber-500 focus:outline-none transition-colors"
              style={{
                fontFamily: "'IBM Plex Mono', monospace"
              }}
            >
              <option value="ALL">All Projects</option>
              {uniqueProjects.map(proj => (
                <option key={proj} value={proj}>{proj}</option>
              ))}
            </select>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur">
            <label className="text-zinc-400 text-sm mb-2 block font-medium" style={{
              fontFamily: "'IBM Plex Mono', monospace"
            }}>Date Range</label>
            <div className="text-white font-mono text-sm">
              {dateRange.start} → {dateRange.end}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-transparent blur-2xl"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm font-medium" style={{
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>Total Revenue</span>
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-emerald-400 mb-1" style={{
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  ${(summary.total.revenue / 1000000).toFixed(2)}M
                </div>
                <div className="text-zinc-500 text-xs" style={{
                  fontFamily: "'IBM Plex Mono', monospace"
                }}>
                  {filteredData.length} days
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/20 to-transparent blur-2xl"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm font-medium" style={{
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>Total Costs</span>
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                <div className="text-3xl font-bold text-red-400 mb-1" style={{
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  ${(summary.total.costs / 1000000).toFixed(2)}M
                </div>
                <div className="text-zinc-500 text-xs" style={{
                  fontFamily: "'IBM Plex Mono', monospace"
                }}>
                  O&M + Marketing
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent blur-2xl"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm font-medium" style={{
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>Net Margin</span>
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div className={`text-3xl font-bold mb-1 ${summary.total.margin >= 0 ? 'text-blue-400' : 'text-red-400'}`} style={{
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  ${(summary.total.margin / 1000000).toFixed(2)}M
                </div>
                <div className="text-zinc-500 text-xs" style={{
                  fontFamily: "'IBM Plex Mono', monospace"
                }}>
                  {((summary.total.margin / summary.total.revenue) * 100).toFixed(1)}% margin
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-transparent blur-2xl"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-zinc-400 text-sm font-medium" style={{
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>Active Alerts</span>
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-3xl font-bold text-amber-400 mb-1" style={{
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  {riskAlerts.length}
                </div>
                <div className="text-zinc-500 text-xs" style={{
                  fontFamily: "'IBM Plex Mono', monospace"
                }}>
                  {riskAlerts.filter(a => a.severity === 'critical').length} critical
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content based on view mode */}
        {viewMode === 'summary' && summary && (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4" style={{
                fontFamily: "'Space Grotesk', sans-serif"
              }}>Market Breakdown</h2>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(summary.byISO).map(([iso, data]) => (
                  <div key={iso} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold" style={{
                        fontFamily: "'Space Grotesk', sans-serif"
                      }}>{iso}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        iso === 'ERCOT' ? 'bg-purple-500/20 text-purple-400' :
                        iso === 'PJM' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {iso}
                      </span>
                    </div>
                    
                    <div className="space-y-3" style={{
                      fontFamily: "'IBM Plex Mono', monospace"
                    }}>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Revenue</span>
                        <span className="text-emerald-400 font-bold">
                          ${(data.revenue / 1000000).toFixed(2)}M
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Net Margin</span>
                        <span className={`font-bold ${data.margin >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                          ${(data.margin / 1000000).toFixed(2)}M
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Basis Revenue</span>
                        <span className="text-amber-400 font-bold">
                          ${(data.basisRevenue / 1000000).toFixed(2)}M
                        </span>
                      </div>
                      {data.imbalanceCost > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Imbalance Cost</span>
                          <span className="text-red-400 font-bold">
                            ${(data.imbalanceCost / 1000000).toFixed(2)}M
                          </span>
                        </div>
                      )}
                      <div className="pt-3 border-t border-zinc-700 flex justify-between text-sm">
                        <span className="text-zinc-400">Gen vs Budget</span>
                        <span className={`font-bold ${
                          ((data.actualGen - data.budgetGen) / data.budgetGen * 100) >= 0 
                            ? 'text-emerald-400' 
                            : 'text-red-400'
                        }`}>
                          {((data.actualGen - data.budgetGen) / data.budgetGen * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  Daily P&L Trend
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyPLChart}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#71717a" 
                      style={{ fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace" }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis 
                      stroke="#71717a" 
                      style={{ fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace" }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#18181b', 
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '12px'
                      }}
                      formatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Legend 
                      wrapperStyle={{ 
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '12px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)"
                      name="Revenue"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="margin" 
                      stroke="#60a5fa" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorMargin)"
                      name="Net Margin"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Revenue Breakdown by ISO
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={isoRevenueChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      dataKey="iso" 
                      stroke="#71717a"
                      style={{ fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}
                    />
                    <YAxis 
                      stroke="#71717a"
                      style={{ fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace" }}
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#18181b', 
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '12px'
                      }}
                      formatter={(value) => `$${(value / 1000000).toFixed(2)}M`}
                    />
                    <Legend 
                      wrapperStyle={{ 
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="PPA Revenue" stackId="a" fill="#10b981" />
                    <Bar dataKey="Basis Revenue" stackId="a" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur col-span-2">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  <Zap className="w-5 h-5 text-blue-400" />
                  Generation: Actual vs Budget by Project
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={genBudgetChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#71717a"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      style={{ fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace" }}
                    />
                    <YAxis 
                      stroke="#71717a"
                      style={{ fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace" }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#18181b', 
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '12px'
                      }}
                      formatter={(value, name) => {
                        if (name === 'Variance %') return `${value.toFixed(1)}%`;
                        return `${value.toLocaleString()} MWh`;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ 
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="Budget" fill="#3f3f46" />
                    <Bar dataKey="Actual" fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* Risk Alerts View */}
        {viewMode === 'risk' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3" style={{
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              Risk Alerts ({riskAlerts.length})
            </h2>
            
            <div className="space-y-3">
              {riskAlerts.slice(0, 50).map((alert, idx) => (
                <div
                  key={idx}
                  className={`bg-zinc-800/50 border-l-4 ${getSeverityBorder(alert.severity)} rounded-lg p-4 hover:bg-zinc-800 transition-colors`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${getSeverityColor(alert.severity)} text-white`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="font-bold text-white" style={{
                          fontFamily: "'Space Grotesk', sans-serif"
                        }}>
                          {alert.type}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          alert.iso === 'ERCOT' ? 'bg-purple-500/20 text-purple-400' :
                          alert.iso === 'PJM' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {alert.iso}
                        </span>
                      </div>
                      <div className="text-zinc-300 mb-1" style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '0.9rem'
                      }}>
                        {alert.project}
                      </div>
                      <div className="text-zinc-500 text-sm" style={{
                        fontFamily: "'IBM Plex Mono', monospace"
                      }}>
                        {alert.date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold" style={{
                        fontFamily: "'IBM Plex Mono', monospace"
                      }}>
                        {alert.message}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {riskAlerts.length > 50 && (
              <div className="mt-4 text-center text-zinc-500 text-sm">
                Showing first 50 of {riskAlerts.length} alerts
              </div>
            )}
          </div>
        )}

        {/* Budget Performance View */}
        {viewMode === 'budgets' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur">
            <h2 className="text-xl font-bold mb-6" style={{
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              Budget vs Actual Performance
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700" style={{
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>
                    <th className="text-left py-3 px-4 text-zinc-400 text-sm font-medium">Project</th>
                    <th className="text-left py-3 px-4 text-zinc-400 text-sm font-medium">ISO</th>
                    <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Actual Gen (MWh)</th>
                    <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Budget Gen (MWh)</th>
                    <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Variance</th>
                    <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Avg Daily Revenue</th>
                  </tr>
                </thead>
                <tbody style={{
                  fontFamily: "'IBM Plex Mono', monospace"
                }}>
                  {budgetPerformance.map((proj, idx) => (
                    <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{proj.name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          proj.iso === 'ERCOT' ? 'bg-purple-500/20 text-purple-400' :
                          proj.iso === 'PJM' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {proj.iso}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-300">
                        {proj.actualGen.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-300">
                        {proj.budgetGen.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        proj.genVariance >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {proj.genVariance >= 0 ? '+' : ''}{proj.genVariance.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400 font-bold">
                        ${proj.avgDailyRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Projects Table View */}
        {viewMode === 'projects' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-900 border-b border-zinc-700">
                  <tr style={{
                    fontFamily: "'IBM Plex Mono', monospace"
                  }}>
                    <th className="text-left py-4 px-6 text-zinc-400 text-xs font-medium">Date</th>
                    <th className="text-left py-4 px-6 text-zinc-400 text-xs font-medium">Project</th>
                    <th className="text-left py-4 px-6 text-zinc-400 text-xs font-medium">ISO</th>
                    <th className="text-right py-4 px-6 text-zinc-400 text-xs font-medium">Gen (MWh)</th>
                    <th className="text-right py-4 px-6 text-zinc-400 text-xs font-medium">Revenue</th>
                    <th className="text-right py-4 px-6 text-zinc-400 text-xs font-medium">Costs</th>
                    <th className="text-right py-4 px-6 text-zinc-400 text-xs font-medium">Net P&L</th>
                    <th className="text-right py-4 px-6 text-zinc-400 text-xs font-medium">vs Budget</th>
                  </tr>
                </thead>
                <tbody style={{
                  fontFamily: "'IBM Plex Mono', monospace"
                }}>
                  {filteredData.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-6 text-zinc-400 text-sm">{row.date}</td>
                      <td className="py-3 px-6 text-white text-sm font-medium">{row.project_name}</td>
                      <td className="py-3 px-6">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          row.iso === 'ERCOT' ? 'bg-purple-500/20 text-purple-400' :
                          row.iso === 'PJM' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {row.iso}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right text-zinc-300 text-sm">
                        {row.actual_gen_mwh.toFixed(0)}
                      </td>
                      <td className="py-3 px-6 text-right text-emerald-400 text-sm font-bold">
                        ${row.total_revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className="py-3 px-6 text-right text-red-400 text-sm">
                        ${row.total_costs.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className={`py-3 px-6 text-right text-sm font-bold ${
                        row.net_pl >= 0 ? 'text-blue-400' : 'text-red-400'
                      }`}>
                        ${row.net_pl.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className={`py-3 px-6 text-right text-sm ${
                        row.gen_vs_budget_pct >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {row.gen_vs_budget_pct >= 0 ? '+' : ''}{row.gen_vs_budget_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredData.length > 100 && (
              <div className="p-4 text-center text-zinc-500 text-sm border-t border-zinc-800">
                Showing first 100 of {filteredData.length} records
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-zinc-600 text-sm" style={{
          fontFamily: "'IBM Plex Mono', monospace"
        }}>
          <p>Power Market P&L Analytics • Demo Version</p>
          <p className="mt-1 opacity-60">ERCOT RT Basis • PJM/MISO DA + Imbalance • Automated Risk Detection</p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
};

export default PowerMarketDashboard;