import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, RefreshCw, Table, BarChart3, GraduationCap, 
  Clock, BookOpen, TrendingUp, Users, Award, 
  Percent, Calendar, Lock, Key, ChevronRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

/**
 * 군위 몰입 수학 성적관리 대시보드
 * - 분석 화면 복구
 * - 모바일 반응형 리스트 적용
 * - Recharts 라이브러리 기반 통계 구현
 */
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState(false);
  const CORRECT_PASSWORD = "321!"; 

  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('analysis'); 
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [dataDate, setDataDate] = useState(null);

  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSa-LxLhjy5tVmwaj0kssahHZJUhaqe9LMiPc5TLsbTwrmlfpc0mWq8aYXVSqtIH8KXD102VlRCPfev/pub?output=csv";

  // --- 유틸리티 및 데이터 파싱 ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) { setIsAuthenticated(true); setPassError(false); }
    else { setPassError(true); setPassword(''); }
  };

  const getMonthFromValue = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    const matchMonth = s.match(/(\d+)\s*월/);
    if (matchMonth) return parseInt(matchMonth[1]);
    const dateParts = s.split(/[-./]/);
    if (dateParts.length >= 2) {
      const m = parseInt(dateParts[1]);
      return (m >= 1 && m <= 12) ? m : null;
    }
    return null;
  };

  const parseCSV = (text) => {
    const result = []; let row = []; let col = ""; let inQuotes = false;
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
        setHeaders(headerRow);
        setData(dataRows);
        const dateH = headerRow.find(h => h.includes('타임스탬프') || h.includes('날짜'));
        if (dateH && dataRows.length > 0) setDataDate(dataRows[0][dateH]);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated]);

  // --- 데이터 매핑 및 분석 로직 ---
  const scoreHeader = useMemo(() => headers.find(h => h.includes('성적') || h.includes('점수')), [headers]);
  const gradeHeader = useMemo(() => headers.find(h => h.includes('학년')), [headers]);
  const nameHeader = useMemo(() => headers.find(h => h.includes('이름')), [headers]);
  const dateHeader = useMemo(() => headers.find(h => h.includes('타임스탬프') || h.includes('날짜')), [headers]);
  const monthInputHeader = useMemo(() => headers.find(h => h.includes('월')), [headers]);

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

  const availableMonths = useMemo(() => Object.keys(monthlyDataMap).map(Number).sort((a, b) => a - b), [monthlyDataMap]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) setSelectedMonth(availableMonths[availableMonths.length - 1]);
  }, [availableMonths, selectedMonth]);

  const stats = useMemo(() => {
    if (!selectedMonth || !monthlyDataMap[selectedMonth]) return null;
    const mData = monthlyDataMap[selectedMonth];
    const avg = mData.scores.length ? (mData.scores.reduce((a, b) => a + b, 0) / mData.scores.length).toFixed(1) : 0;
    
    const gradeStats = {};
    mData.rows.forEach(item => {
      const g = item[gradeHeader];
      const s = parseFloat(String(item[scoreHeader]).replace(/[^0-9.]/g, ''));
      if (g) {
        if (!gradeStats[g]) gradeStats[g] = { total: 0, count: 0 };
        if (!isNaN(s)) { gradeStats[g].total += s; gradeStats[g].count++; }
      }
    });

    return {
      avg,
      students: mData.students.size,
      max: mData.scores.length ? Math.max(...mData.scores) : 0,
      excellence: mData.scores.length ? ((mData.scores.filter(s => s >= 90).length / mData.scores.length) * 100).toFixed(1) : 0,
      gradeDetails: Object.keys(gradeStats).sort().map(g => ({
        grade: g,
        avg: gradeStats[g].count ? (gradeStats[g].total / gradeStats[g].count).toFixed(1) : 0
      }))
    };
  }, [selectedMonth, monthlyDataMap, gradeHeader, scoreHeader]);

  const chartData = useMemo(() => {
    return availableMonths.map(m => ({
      name: `${m}월`,
      avg: monthlyDataMap[m].scores.length ? parseFloat((monthlyDataMap[m].scores.reduce((a, b) => a + b, 0) / monthlyDataMap[m].scores.length).toFixed(1)) : 0
    }));
  }, [availableMonths, monthlyDataMap]);

  const filteredData = useMemo(() => {
    return data.filter(d => Object.values(d).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())));
  }, [data, searchTerm]);

  // --- UI 컴포넌트 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8"><Lock className="text-white" size={36} /></div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">군위 몰입 수학</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" placeholder="비밀번호 입력"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-center text-lg font-black outline-none"
              value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
            />
            {passError && <p className="text-rose-500 text-xs font-black">비밀번호가 틀렸습니다.</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">입장하기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-6">
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-[#6366f1] rounded-2xl flex items-center justify-center shadow-xl"><GraduationCap className="text-white" size={28} /></div>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-slate-900">군위 몰입 수학</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock size={12} className="text-indigo-400" />
                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">{dataDate || '로딩 중...'}</span>
              </div>
            </div>
          </div>
          <div className="flex w-full lg:w-auto bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
            <button onClick={() => setViewMode('analysis')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all ${viewMode === 'analysis' ? 'bg-[#6366f1] text-white' : 'text-slate-400'}`}>분석</button>
            <button onClick={() => setViewMode('table')} className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all ${viewMode === 'table' ? 'bg-[#6366f1] text-white' : 'text-slate-400'}`}>리스트</button>
            <button onClick={fetchData} className="p-2.5 text-slate-300 hover:text-indigo-600"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </header>

        {viewMode === 'analysis' ? (
          <div className="space-y-6">
            <div className="bg-white p-2 rounded-2xl border border-slate-200 w-fit flex gap-1 shadow-sm">
              {availableMonths.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${selectedMonth === m ? 'bg-[#6366f1] text-white' : 'text-slate-400'}`}>{m}월</button>
              ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="평균 점수" value={stats?.avg} unit="점" icon={<TrendingUp />} />
              <StatCard title="수강생" value={stats?.students} unit="명" icon={<Users />} />
              <StatCard title="최고 점수" value={stats?.max} unit="점" icon={<Award />} />
              <StatCard title="우수 비율" value={stats?.excellence} unit="%" icon={<Percent />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm h-[400px]">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><BarChart3 size={20} className="text-indigo-500" /> 월별 성적 추이</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#94a3b8'}} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Area type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorAvg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><BookOpen size={20} className="text-indigo-500" /> 학년별 평균</h3>
                <div className="space-y-6">
                  {stats?.gradeDetails.map((g, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm font-black mb-2">
                        <span className="text-slate-600">{g.grade}</span>
                        <span className="text-indigo-600">{g.avg}점</span>
                      </div>
                      <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${g.avg}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input type="text" placeholder="이름, 학년 검색..." className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-indigo-50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            <div className="hidden md:block bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    {headers.map((h, i) => <th key={i} className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.map((row, i) => (
                    <tr key={i} className="hover:bg-indigo-50/20 transition-all">
                      {headers.map((h, j) => {
                        const isScore = h.includes('성적') || h.includes('점수');
                        const sVal = parseFloat(String(row[h]).replace(/[^0-9.]/g, ''));
                        return (
                          <td key={j} className="px-8 py-5 text-[14px] font-black">
                            <span className={isScore ? (sVal >= 90 ? 'text-emerald-500' : 'text-indigo-500') : 'text-slate-600'}>{row[h]}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-4">
              {filteredData.map((row, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-lg font-black text-slate-800">{row[nameHeader] || '익명'}</p>
                    <p className="text-xs font-bold text-slate-400">{row[gradeHeader]} • {row[monthInputHeader] || '기록없음'}</p>
                  </div>
                  <div className={`text-2xl font-black ${parseFloat(row[scoreHeader]) >= 90 ? 'text-emerald-500' : 'text-indigo-500'}`}>{row[scoreHeader]}점</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, unit, icon }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
    <div className="text-indigo-500 mb-3">{icon}</div>
    <p className="text-[11px] font-black text-slate-400 uppercase mb-1">{title}</p>
    <div className="flex items-baseline gap-1">
      <span className="text-xl md:text-2xl font-black">{value || '--'}</span>
      <span className="text-xs font-bold text-slate-400">{unit}</span>
    </div>
  </div>
);

export default App;
