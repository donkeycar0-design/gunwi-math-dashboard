import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, RefreshCw, Table, BarChart3, GraduationCap, 
  Clock, BookOpen, TrendingUp, Users, Award, 
  Percent, Calendar
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

/**
 * 군위 몰입 수학 성적관리 대시보드
 * 1. 라이브러리 의존성: recharts, lucide-react (npm install recharts lucide-react)
 * 2. Y축 범위: 50 - 100 고정 (변화도 강조)
 * 3. 학년별/월별 인터렉티브 분석 기능 포함
 */
const App = () => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('analysis'); // 기본 분석 모드
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [dataDate, setDataDate] = useState(null);

  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSa-LxLhjy5tVmwaj0kssahHZJUhaqe9LMiPc5TLsbTwrmlfpc0mWq8aYXVSqtIH8KXD102VlRCPfev/pub?output=csv";

  // 날짜/월 추출 유틸리티
  const getMonthFromValue = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    const matchMonth = s.match(/(\d+)\s*월/);
    if (matchMonth) return parseInt(matchMonth[1]);
    const dateParts = s.split(/[-./]/);
    if (dateParts.length >= 2) {
      const m = parseInt(dateParts[1]);
      if (m >= 1 && m <= 12) return m;
    }
    return null;
  };

  const parseKoreanDate = (dateStr) => {
    if (!dateStr) return 0;
    try {
      const parts = dateStr.match(/\d+/g);
      if (!parts || parts.length < 3) return 0;
      let [year, month, day, hour, minute] = parts.map(Number);
      if (dateStr.includes('오후') && hour < 12) hour += 12;
      if (dateStr.includes('오전') && hour === 12) hour = 0;
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day, hour || 0, minute || 0).getTime();
    } catch (e) { return 0; }
  };

  const parseCSV = (text) => {
    const result = [];
    let row = [];
    let col = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"' && text[i+1] === '"') { col += '"'; i++; }
        else if (char === '"') inQuotes = false;
        else col += char;
      } else {
        if (char === '"') inQuotes = true;
        else if (char === ',') { row.push(col.trim()); col = ""; }
        else if (char === '\r' || char === '\n') {
          row.push(col.trim());
          if (row.length > 0) result.push(row);
          row = []; col = "";
          if (char === '\r' && text[i+1] === '\n') i++;
        } else col += char;
      }
    }
    if (row.length > 0 || col !== "") { row.push(col.trim()); result.push(row); }
    return result;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${csvUrl}&t=${new Date().getTime()}`);
      const csvText = await response.text();
      const parsedRows = parseCSV(csvText);
      if (parsedRows.length > 0) {
        const headerRow = parsedRows[0];
        let dataRows = parsedRows.slice(1).map(row => {
          const obj = {};
          headerRow.forEach((header, i) => { obj[header] = row[i] || ''; });
          return obj;
        });
        
        const dateH = headerRow.find(h => h.includes('타임스탬프') || h.includes('날짜'));
        if (dateH) {
          dataRows.sort((a, b) => parseKoreanDate(b[dateH]) - parseKoreanDate(a[dateH]));
          setDataDate(dataRows[0][dateH]);
        }
        setHeaders(headerRow);
        setData(dataRows);
      }
    } catch (err) { console.error("데이터 로드 실패:", err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // 헤더 매핑
  const scoreHeader = useMemo(() => headers.find(h => h.includes('성적') || h.includes('점수')), [headers]);
  const gradeHeader = useMemo(() => headers.find(h => h.includes('학년')), [headers]);
  const nameHeader = useMemo(() => headers.find(h => h.includes('이름')), [headers]);
  const dateHeader = useMemo(() => headers.find(h => h.includes('타임스탬프') || h.includes('날짜')), [headers]);
  const monthInputHeader = useMemo(() => headers.find(h => h.includes('월 입력') || h.includes('월별')), [headers]);

  // 월별 데이터 맵 생성
  const monthlyDataMap = useMemo(() => {
    const months = {};
    data.forEach(item => {
      let m = getMonthFromValue(item[monthInputHeader]) || getMonthFromValue(item[dateHeader]);
      if (m) {
        if (!months[m]) months[m] = { rows: [], scores: [], students: new Set() };
        months[m].rows.push(item);
        const s = parseFloat(String(item[scoreHeader]).replace(/[^0-9.]/g, ''));
        if (!isNaN(s)) months[m].scores.push(s);
        if (item[nameHeader]) months[m].students.add(item[nameHeader]);
      }
    });
    return months;
  }, [data, headers, scoreHeader, dateHeader, monthInputHeader, nameHeader]);

  const availableMonthsList = useMemo(() => Object.keys(monthlyDataMap).map(Number).sort((a, b) => a - b), [monthlyDataMap]);

  // 차트 데이터 (평균 점수 계산)
  const chartData = useMemo(() => {
    return availableMonthsList.map(m => {
      const scores = monthlyDataMap[m].scores;
      const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return {
        name: `${m}월`,
        average: parseFloat(avg.toFixed(1))
      };
    });
  }, [availableMonthsList, monthlyDataMap]);

  useEffect(() => {
    if (availableMonthsList.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonthsList[availableMonthsList.length - 1]);
    }
  }, [availableMonthsList, selectedMonth]);

  // 선택된 월의 통계 정보
  const currentMonthStats = useMemo(() => {
    if (!selectedMonth || !monthlyDataMap[selectedMonth]) return null;
    const mData = monthlyDataMap[selectedMonth];
    const avg = mData.scores.length ? (mData.scores.reduce((a,b)=>a+b,0) / mData.scores.length).toFixed(1) : 0;
    
    const gradeStats = {};
    mData.rows.forEach(item => {
      const g = item[gradeHeader];
      const s = parseFloat(String(item[scoreHeader]).replace(/[^0-9.]/g, ''));
      if (g) {
        if (!gradeStats[g]) gradeStats[g] = { total: 0, count: 0, students: new Set() };
        if (!isNaN(s)) { gradeStats[g].total += s; gradeStats[g].count++; }
        if (item[nameHeader]) gradeStats[g].students.add(item[nameHeader]);
      }
    });

    return {
      month: selectedMonth,
      students: mData.students.size,
      avg: avg,
      max: mData.scores.length ? Math.max(...mData.scores) : 0,
      min: mData.scores.length ? Math.min(...mData.scores) : 0,
      excellence: mData.scores.length ? ((mData.scores.filter(s => s >= 90).length / mData.scores.length) * 100).toFixed(1) : 0,
      gradeDetails: Object.keys(gradeStats).sort().map(g => ({
        grade: g,
        avg: gradeStats[g].count ? (gradeStats[g].total / gradeStats[g].count).toFixed(1) : 0,
        count: gradeStats[g].students.size
      }))
    };
  }, [selectedMonth, monthlyDataMap, gradeHeader, scoreHeader, nameHeader]);

  const filteredData = useMemo(() => {
    return data.filter(d => Object.values(d).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())));
  }, [data, searchTerm]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 섹션 */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-[#6366f1] rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200">
              <GraduationCap className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">군위 몰입 수학</h1>
              <div className="flex items-center gap-2 mt-1">
                <Clock size={14} className="text-indigo-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">마지막 동기화: {dataDate || '--'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center bg-white p-2 rounded-[1.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
            <button 
              onClick={() => setViewMode('table')}
              className={`px-8 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-[#6366f1] text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Table size={18} /> 리스트
            </button>
            <button 
              onClick={() => setViewMode('analysis')}
              className={`px-8 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2 ${viewMode === 'analysis' ? 'bg-[#6366f1] text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <BarChart3 size={18} /> 데이터 분석
            </button>
            <button onClick={fetchData} className="ml-3 p-3 text-slate-300 hover:text-indigo-600 transition-colors">
              <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {viewMode === 'table' ? (
          /* 리스트 뷰 */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
               <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                 <div className="w-2 h-8 bg-indigo-500 rounded-full"/> 전체 성적 리스트
               </h2>
               <div className="relative w-full md:w-[420px]">
                <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="학생 이름 또는 학년으로 검색..."
                  className="w-full pl-14 pr-8 py-4 bg-white border border-slate-200 rounded-3xl text-[15px] font-bold shadow-sm focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-10 py-5 text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Index</th>
                      {headers.map((h, i) => (
                        <th key={i} className="px-10 py-5 text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((row, i) => (
                      <tr key={i} className="hover:bg-indigo-50/20 transition-all cursor-default">
                        <td className="px-10 py-6 text-sm font-black text-slate-200">{filteredData.length - i}</td>
                        {headers.map((h, j) => {
                          const val = row[h];
                          const isScore = h.includes('성적') || h.includes('점수');
                          const scoreVal = parseFloat(String(val).replace(/[^0-9.]/g, ''));
                          return (
                            <td key={j} className="px-10 py-6">
                              <span className={`text-[15px] font-black ${isScore ? (scoreVal >= 90 ? 'text-emerald-500' : scoreVal < 70 ? 'text-rose-400' : 'text-indigo-500') : 'text-slate-600'}`}>
                                {val}{isScore ? '점' : ''}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* 분석 뷰 */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
             {/* 필터 바 */}
             <div className="bg-white p-3 rounded-3xl border border-slate-200 w-fit flex items-center shadow-lg shadow-slate-200/40">
              <div className="px-6 py-2 border-r border-slate-100 flex items-center gap-3 mr-2">
                <Calendar size={20} className="text-indigo-500" />
                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Select Month</span>
              </div>
              <div className="flex gap-2">
                {availableMonthsList.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className={`px-7 py-3 rounded-2xl text-[15px] font-black transition-all ${selectedMonth === m ? 'bg-[#6366f1] text-white shadow-xl shadow-indigo-100 scale-105' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                  >
                    {m}월
                  </button>
                ))}
              </div>
            </div>

            {/* 카드 섹션 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title={`${selectedMonth}월 수강생`} value={currentMonthStats?.students} unit="명" sub="학원 재원생 기준" icon={<Users />} />
              <StatCard title={`${selectedMonth}월 평균`} value={currentMonthStats?.avg} unit="점" sub="전체 학년 합산 데이터" icon={<TrendingUp />} />
              <StatCard title="최고 / 최저 점수" value={currentMonthStats ? `${currentMonthStats.max}/${currentMonthStats.min}` : '--'} unit="점" sub="해당 월 시험 결과" icon={<Award />} />
              <StatCard title="우수 학생 비율" value={currentMonthStats?.excellence} unit="%" sub="90점 이상 고득점자" icon={<Percent />} />
            </div>

            {/* 메인 분석 영역 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm min-h-[480px]">
                 <div className="flex justify-between items-start mb-10">
                   <div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-3">
                      <TrendingUp size={28} className="text-indigo-500" /> 월별 성적 변화 추이
                    </h3>
                    <p className="text-[15px] text-slate-400 font-bold tracking-tight italic">
                      Y축 점수 범위를 <span className="text-indigo-500 underline decoration-indigo-200 underline-offset-4">50점 ~ 100점</span>으로 조정하여 변화량을 강조했습니다.
                    </p>
                   </div>
                   <div className="px-4 py-1.5 bg-indigo-50 rounded-xl text-[11px] font-black text-indigo-500 uppercase tracking-widest">
                     Dynamic Chart
                   </div>
                 </div>
                 
                 <div className="h-[320px] w-full mt-4">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 14, fontWeight: 900, fill: '#94a3b8'}} 
                            dy={15}
                          />
                          <YAxis 
                            domain={[50, 100]} 
                            axisLine={false} 
                            tickLine={false} 
                            tickCount={6}
                            tick={{fontSize: 13, fontWeight: 900, fill: '#cbd5e1'}} 
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px' }}
                            itemStyle={{ fontWeight: 900, fontSize: '18px', color: '#6366f1' }}
                            labelStyle={{ fontWeight: 900, marginBottom: '8px', color: '#1e293b', fontSize: '14px' }}
                            cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="average" 
                            stroke="#6366f1" 
                            strokeWidth={6}
                            fillOpacity={1} 
                            fill="url(#chartGradient)" 
                            animationDuration={2000}
                            activeDot={{ r: 8, strokeWidth: 0, fill: '#6366f1' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                         <div className="w-12 h-12 bg-slate-50 rounded-full animate-pulse" />
                         <span className="font-black text-sm">데이터 분석 중...</span>
                      </div>
                    )}
                 </div>
               </div>

               {/* 학년별 상세 */}
               <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                  <h3 className="font-black text-slate-800 text-xl mb-8 flex items-center gap-3">
                    <BookOpen size={26} className="text-indigo-500"/> 학년별 상세 (평균)
                  </h3>
                  <div className="space-y-7">
                    {currentMonthStats?.gradeDetails.length ? currentMonthStats.gradeDetails.map((g, idx) => (
                      <div key={idx} className="group cursor-default">
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-[16px] font-black text-slate-700 flex items-center gap-3">
                            {g.grade} 
                            <span className="text-[11px] px-3 py-1 bg-slate-50 text-slate-400 rounded-lg font-black group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all">{g.count}명 참여</span>
                          </span>
                          <span className="text-[18px] font-black text-indigo-500">{g.avg}점</span>
                        </div>
                        <div className="h-4 bg-slate-50 rounded-full overflow-hidden p-1">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-1500 ease-out shadow-sm" 
                            style={{ width: `${Math.max(0, (parseFloat(g.avg) - 50) * 2)}%` }} 
                          />
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-20 text-slate-200 font-black italic">No Data Available</div>
                    )}
                  </div>
                  
                  <div className="mt-12 p-6 bg-slate-50 rounded-3xl">
                     <p className="text-[13px] font-bold text-slate-400 leading-relaxed">
                       * 위 막대 그래프는 변별력을 위해 50점을 기점으로 비례하여 표시됩니다.
                     </p>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, unit, sub, icon }) => {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm group hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 rotate-3 group-hover:rotate-0">
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <p className="text-[13px] font-black text-slate-400 mb-2 uppercase tracking-tighter">{title}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-black text-slate-900 tabular-nums">{value || '--'}</span>
        <span className="text-sm font-black text-slate-300">{unit}</span>
      </div>
      <div className="mt-5 pt-5 border-t border-slate-50 flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{sub}</p>
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-200 animate-pulse" />
      </div>
    </div>
  );
};

export default App;
