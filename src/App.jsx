import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, RefreshCw, Table, BarChart3, GraduationCap, 
  Clock, BookOpen, TrendingUp, Users, Award, 
  Percent, Calendar, Lock, Key
} from 'lucide-react';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState(false);
  const CORRECT_PASSWORD = "321!"; // 👈 비밀번호

  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('analysis');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [dataDate, setDataDate] = useState(null);

  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSa-LxLhjy5tVmwaj0kssahHZJUhaqe9LMiPc5TLsbTwrmlfpc0mWq8aYXVSqtIH8KXD102VlRCPfev/pub?output=csv";

  // 한국어 날짜(타임스탬프) 파싱 함수
  const parseKoreanDate = (dateStr) => {
    if (!dateStr) return 0;
    try {
      const parts = dateStr.match(/\d+/g);
      if (!parts || parts.length < 3) return 0;
      let [year, month, day, hour, minute, second] = parts.map(Number);
      if (dateStr.includes('오후') && hour < 12) hour += 12;
      if (dateStr.includes('오전') && hour === 12) hour = 0;
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0).getTime();
    } catch (e) { return 0; }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) { setIsAuthenticated(true); setPassError(false); }
    else { setPassError(true); setPassword(''); }
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
        const dateH = headerRow.find(h => h.includes('타임스탬프') || h.includes('날짜'));

        let dataRows = parsedRows.slice(1).map((row, idx) => {
          const obj = { _originalIndex: idx };
          headerRow.forEach((header, i) => { obj[header] = row[i] || ''; });
          return obj;
        });

        // 데이터 최신순 정렬
        if (dateH) {
          dataRows.sort((a, b) => parseKoreanDate(b[dateH]) - parseKoreanDate(a[dateH]));
          setDataDate(dataRows[0][dateH]);
        }

        setHeaders(headerRow);
        setData(dataRows);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated]);

  // 주요 헤더 매핑
  const nameHeader = useMemo(() => headers.find(h => h.includes('이름')), [headers]);
  const scoreHeader = useMemo(() => headers.find(h => h.includes('성적') || h.includes('점수')), [headers]);
  const gradeHeader = useMemo(() => headers.find(h => h.includes('학년')), [headers]);
  const dateHeader = useMemo(() => headers.find(h => h.includes('타임스탬프') || h.includes('날짜')), [headers]);
  const monthInputHeader = useMemo(() => headers.find(h => h.includes('월')), [headers]);

  // 월별 데이터 그룹화
  const monthlyDataMap = useMemo(() => {
    const months = {};
    data.forEach(item => {
      const s = String(item[monthInputHeader] || item[dateHeader] || "");
      const matchMonth = s.match(/(\d+)\s*월/);
      let m = matchMonth ? parseInt(matchMonth[1]) : null;
      if (m) {
        if (!months[m]) months[m] = { rows: [], scores: [], students: new Set() };
        months[m].rows.push(item);
        const score = parseFloat(String(item[scoreHeader]).replace(/[^0-9.]/g, ''));
        if (!isNaN(score)) months[m].scores.push(score);
        if (item[nameHeader]) months[m].students.add(item[nameHeader]);
      }
    });
    return months;
  }, [data, headers, scoreHeader, nameHeader, monthInputHeader, dateHeader]);

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
      gradeDetails: Object.keys(gradeStats).sort().map(g => ({ grade: g, avg: gradeStats[g].count ? (gradeStats[g].total / gradeStats[g].count).toFixed(1) : 0 }))
    };
  }, [selectedMonth, monthlyDataMap, gradeHeader, scoreHeader]);

  const filteredData = useMemo(() => {
    return data.filter(d => Object.values(d).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())));
  }, [data, searchTerm]);

  // 그래프 포인트 계산
  const lineChartPoints = useMemo(() => {
    if (availableMonths.length < 1) return [];
    const width = 800;
    const padding = 60;
    const stepX = (width - padding * 2) / Math.max(availableMonths.length - 1, 1);
    return availableMonths.map((m, i) => {
      const mData = monthlyDataMap[m];
      const avg = mData.scores.length ? (mData.scores.reduce((a,b)=>a+b,0) / mData.scores.length) : 0;
      return { x: padding + i * stepX, y: 250 - (avg / 100 * 200), avg, month: m };
    });
  }, [availableMonths, monthlyDataMap]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl"><Lock className="text-white" size={36} /></div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">군위 몰입 수학</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" placeholder="비밀번호" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-center text-lg font-black outline-none" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            {passError && <p className="text-rose-500 text-xs font-black">비밀번호가 틀렸습니다.</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg transition-transform active:scale-95">입장하기</button>
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
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><GraduationCap className="text-white" size={32} /></div>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                <h1 className="text-2xl font-black text-slate-900">군위 몰입 수학</h1>
                <span className="text-[10px] font-bold text-slate-400">Developed by Teach for Future (Sangjin Hong / Byungdu Kim)</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5"><Clock size={12} className="text-indigo-400" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dataDate || '최신 데이터 불러오는 중...'}</span></div>
            </div>
          </div>
          <div className="flex w-full lg:w-auto bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
            <button onClick={() => setViewMode('analysis')} className={`flex-1 lg:flex-none px-8 py-3 rounded-xl text-sm font-black transition-all ${viewMode === 'analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>분석</button>
            <button onClick={() => setViewMode('table')} className={`flex-1 lg:flex-none px-8 py-3 rounded-xl text-sm font-black transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>리스트</button>
            <button onClick={fetchData} className="p-3 text-slate-300 hover:text-indigo-600"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </header>

        {viewMode === 'analysis' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* 월 선택 */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {availableMonths.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)} className={`px-6 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all ${selectedMonth === m ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                  {m}월 성적분석
                </button>
              ))}
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <StatCard title="수강 인원" value={stats?.students} unit="명" icon={<Users size={20}/>} />
              <StatCard title="월 평균" value={stats?.avg} unit="점" icon={<TrendingUp size={20}/>} />
              <StatCard title="최고 점수" value={stats?.max} unit="점" icon={<Award size={20}/>} />
              <StatCard title="우수 비율" value={stats?.excellence} unit="%" icon={<Percent size={20}/>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 성적 추이 그래프 */}
              <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                <h3 className="font-black text-slate-800 text-lg mb-8 flex items-center gap-2"><TrendingUp className="text-indigo-500" size={20}/> 월별 평균 변화</h3>
                <div className="h-[250px] w-full">
                  <svg viewBox="0 0 800 300" className="w-full h-full overflow-visible">
                    <path d={lineChartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="#6366f1" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    {lineChartPoints.map((p, i) => (
                      <g key={i} className="cursor-pointer group" onClick={() => setSelectedMonth(p.month)}>
                        <circle cx={p.x} cy={p.y} r={selectedMonth === p.month ? "10" : "6"} className={selectedMonth === p.month ? "fill-white stroke-indigo-600 stroke-[4]" : "fill-indigo-600 stroke-white stroke-[2]"} />
                        <text x={p.x} y="290" textAnchor="middle" className={`text-[18px] font-black ${selectedMonth === p.month ? 'fill-indigo-600' : 'fill-slate-300'}`}>{p.month}월</text>
                        {selectedMonth === p.month && (
                          <g><rect x={p.x-30} y={p.y-45} width="60" height="30" rx="10" fill="#1e293b"/><text x={p.x} y={p.y-25} textAnchor="middle" fill="white" className="text-[12px] font-bold">{p.avg.toFixed(1)}</text></g>
                        )}
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              {/* 학년별 세부 정보 */}
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="font-black text-slate-800 text-lg mb-8 flex items-center gap-2"><BookOpen className="text-indigo-500" size={20}/> 학년별 평균</h3>
                <div className="space-y-6">
                  {stats?.gradeDetails.map((g, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-black text-slate-600">{g.grade}</span>
                        <span className="text-lg font-black text-indigo-600">{g.avg}점</span>
                      </div>
                      <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-50">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${g.avg}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 리스트 뷰 */
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="relative">
              <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
              <input type="text" placeholder="학생 이름이나 학년 검색..." className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-black shadow-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {/* PC 테이블 */}
            <div className="hidden md:block bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b">No</th>
                    {headers.map((h, i) => <th key={i} className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.map((row, i) => (
                    <tr key={i} className="hover:bg-indigo-50/20 transition-all group">
                      <td className="px-8 py-5 text-[14px] font-black text-slate-300 group-hover:text-indigo-300">{data.length - i}</td>
                      {headers.map((h, j) => {
                        const isScore = h.includes('성적') || h.includes('점수');
                        const sVal = parseFloat(String(row[h]).replace(/[^0-9.]/g, ''));
                        return (
                          <td key={j} className="px-8 py-5 text-[14px] font-black">
                            <span className={isScore ? (sVal >= 90 ? 'text-emerald-500' : 'text-indigo-600') : 'text-slate-600'}>{row[h]}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <div className="md:hidden space-y-4 pb-10">
              {filteredData.map((row, i) => (
                <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all active:scale-95">
                  <div className="space-y-1">
                    <p className="text-lg font-black text-slate-800">{row[nameHeader] || '미기입'}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 bg-slate-50 text-slate-500 rounded-md font-bold">{row[gradeHeader]}</span>
                      <span className="text-[11px] text-slate-400 font-bold">{row[monthInputHeader]}</span>
                    </div>
                    <p className="text-[10px] text-slate-300 font-bold mt-1">{row[dateHeader]}</p>
                  </div>
                  <div className={`text-2xl font-black ${parseFloat(row[scoreHeader]) >= 90 ? 'text-emerald-500' : 'text-indigo-600'}`}>
                    {row[scoreHeader]}<span className="text-xs ml-0.5">점</span>
                  </div>
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
  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
    <div className="text-indigo-500 mb-4 bg-indigo-50 w-10 h-10 flex items-center justify-center rounded-xl">{icon}</div>
    <p className="text-[11px] font-black text-slate-400 uppercase mb-1 tracking-tight">{title}</p>
    <div className="flex items-baseline gap-1">
      <span className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter">{value || '--'}</span>
      <span className="text-xs font-bold text-slate-400">{unit}</span>
    </div>
  </div>
);

export default App;
