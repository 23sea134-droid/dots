// ============================================================
// PT TABLET FOLLOW-UP — Mobile-First, Lag-Free
// Pure localStorage | Tab navigation | Touch optimized
// ============================================================

const { useState, useEffect, useMemo, useCallback, useRef } = React;
const STORAGE_KEY = 'ptVisits_v3';

// ─── Helpers ────────────────────────────────────────────────
const calcDays = (a, b) => { const d = Math.ceil((new Date(b) - new Date(a)) / 86400000); return d > 0 ? d : 0; };
const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear()===y.getFullYear() && x.getMonth()===y.getMonth() && x.getDate()===y.getDate(); };
const toDateStr = (d) => new Date(d).toISOString().split('T')[0];

const fmtReg = (v) => {
    const c = v.replace(/[^a-zA-Z0-9]/g, '');
    let f = c.slice(0, 4);
    if (c.length > 4) f += '/' + c.slice(4, 7).toUpperCase();
    if (c.length > 7) f += '/' + c.slice(7, 11);
    return f;
};

const hydrate = (arr) => arr.map(v => ({
    ...v,
    visitDate:     new Date(v.visitDate),
    nextVisitDate: new Date(v.nextVisitDate),
    recordedAt:    new Date(v.recordedAt),
    completedAt:   v.completedAt ? new Date(v.completedAt) : null,
    tabletDays:    v.tabletDays || 0
}));

// ─── App ────────────────────────────────────────────────────
function PTVisitTracker() {
    const [visits,     setVisitsState] = useState([]);
    const [reg,        setReg]         = useState('');
    const [vDate,      setVDate]       = useState(toDateStr(new Date()));
    const [nvDate,     setNVDate]      = useState('');
    const [toast,      setToast]       = useState(null);
    const [activeTab,  setActiveTab]   = useState('home'); // home | assign | calendar | records
    const [regSuggest, setRegSuggest]  = useState(false);

    // Modals
    const [modalDate,    setModalDate]    = useState(null); // date patients modal
    const [showMonth,    setShowMonth]    = useState(false);
    const [showYear,     setShowYear]     = useState(false);
    const [showLookup,   setShowLookup]   = useState(false);
    const [lookupSearch, setLookupSearch] = useState('');
    const [lookupSuggest,setLookupSuggest]= useState(false);
    const [showHistory,  setShowHistory]  = useState(false);
    const [selPatient,   setSelPatient]   = useState(null);

    const toastRef = useRef(null);

    // ── Load ─────────────────────────────────────────────────
    useEffect(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            if (s) setVisitsState(hydrate(JSON.parse(s)));
        } catch(e) { console.error(e); }
    }, []);

    // ── Save ─────────────────────────────────────────────────
    const setVisits = useCallback((v) => {
        setVisitsState(v);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch(e) { console.error(e); }
    }, []);

    // ── Toast ────────────────────────────────────────────────
    const showToast = useCallback((msg, type = 'success') => {
        clearTimeout(toastRef.current);
        setToast({ msg, type });
        toastRef.current = setTimeout(() => setToast(null), 2800);
    }, []);

    // ── Derived data ─────────────────────────────────────────
    const patientData = useMemo(() => {
        const d = {};
        visits.forEach(v => {
            const k = v.regNumber.trim().toUpperCase();
            if (!d[k]) d[k] = { regNumber: v.regNumber, totalDays: 0, visits: [], firstDate: v.visitDate, lastDate: v.visitDate, lastNext: v.nextVisitDate };
            const p = d[k];
            p.totalDays += v.tabletDays;
            p.visits.push(v);
            if (new Date(v.visitDate) < new Date(p.firstDate)) p.firstDate = v.visitDate;
            if (new Date(v.visitDate) > new Date(p.lastDate))  p.lastDate  = v.visitDate;
            if (new Date(v.nextVisitDate) > new Date(p.lastNext)) p.lastNext = v.nextVisitDate;
        });
        Object.values(d).forEach(p => p.visits.sort((a,b) => new Date(a.visitDate)-new Date(b.visitDate)));
        return d;
    }, [visits]);

    const byDate = useMemo(() => {
        const m = {};
        visits.forEach(v => {
            if (v.completed) return;
            const k = new Date(v.nextVisitDate).toDateString();
            if (!m[k]) m[k] = new Set();
            m[k].add(v.regNumber.trim().toUpperCase());
        });
        return Object.fromEntries(Object.entries(m).map(([k,s])=>[k,s.size]));
    }, [visits]);

    const byMonth = useMemo(() => {
        const m = {};
        visits.forEach(v => {
            if (v.completed) return;
            const mo = new Date(v.nextVisitDate).getMonth();
            if (!m[mo]) m[mo] = new Set();
            m[mo].add(v.regNumber.trim().toUpperCase());
        });
        return Object.fromEntries(Object.entries(m).map(([k,s])=>[k,s.size]));
    }, [visits]);

    const totalUnique = useMemo(() => Object.keys(patientData).length, [patientData]);

    const countForDate  = (d) => byDate[new Date(d).toDateString()] || 0;
    const countForMonth = (m) => byMonth[m] || 0;
    const getTotalTablets = (r) => patientData[r.trim().toUpperCase()]?.totalDays || 0;

    const patientsForDate = useCallback((date) => {
        return visits.filter(v => sameDay(v.nextVisitDate, date));
    }, [visits]);

    const today = new Date(); today.setHours(0,0,0,0);
    const todayPatients = useMemo(() => visits.filter(v => sameDay(v.nextVisitDate, today)), [visits]);
    const pendingToday = useMemo(() => new Set(todayPatients.filter(v=>!v.completed).map(v=>v.regNumber.trim().toUpperCase())).size, [todayPatients]);

    // 7 days including today
    const sevenDays = useMemo(() => Array.from({length:7},(_,i)=>{
        const d = new Date(today); d.setDate(today.getDate()+i);
        return { date:d, num:d.getDate(), name: i===0?'Today':d.toLocaleDateString('en-US',{weekday:'short'}), count:countForDate(d), isToday:i===0 };
    }), [byDate]);

    // Mini calendar for current month
    const curMonth = new Date().getMonth();
    const curYear  = new Date().getFullYear();
    const miniCalCells = useMemo(() => {
        const firstDay = new Date(curYear, curMonth, 1).getDay();
        const lastDay  = new Date(curYear, curMonth+1, 0).getDate();
        const cells = [];
        for (let i=0; i<firstDay; i++) cells.push(null);
        for (let d=1; d<=lastDay; d++) {
            const date = new Date(curYear, curMonth, d); date.setHours(0,0,0,0);
            const h = getHolidayForDate(date);
            cells.push({ day:d, date, count:countForDate(date), isToday:date.getTime()===today.getTime(), isSun:date.getDay()===0, isPoya:h?.type==='poya', hol:h });
        }
        return cells;
    }, [visits, curMonth, curYear]);

    // Month view days
    const getMonthViewDays = useCallback((month) => {
        const year = curYear;
        const last = new Date(year, month+1, 0).getDate();
        const first = new Date(year, month, 1).getDay();
        const days = [];
        for (let d=1; d<=last; d++) {
            const date = new Date(year, month, d); date.setHours(0,0,0,0);
            const pending = visits.filter(v => { const x=new Date(v.nextVisitDate); x.setHours(0,0,0,0); return x.getTime()===date.getTime()&&!v.completed; });
            const h = getHolidayForDate(date);
            days.push({ date, day:d, dayName:date.toLocaleDateString('en-US',{weekday:'short'}), count:new Set(pending.map(v=>v.regNumber.trim().toUpperCase())).size, hol:h, isToday:date.getTime()===today.getTime(), isSun:date.getDay()===0 });
        }
        return { days, firstDOW: first };
    }, [visits]);

    // Suggestions
    const regSuggestions = useMemo(() => {
        if (!reg || reg.length < 1) return [];
        const s = reg.toUpperCase();
        return Object.keys(patientData).filter(r => r.includes(s)).slice(0,5);
    }, [reg, patientData]);

    const lookupResults = useMemo(() => {
        const all = Object.values(patientData);
        if (!lookupSearch.trim()) return all.sort((a,b)=>new Date(b.lastDate)-new Date(a.lastDate));
        const s = lookupSearch.trim().toUpperCase();
        return all.filter(p=>p.regNumber.toUpperCase().includes(s)).sort((a,b)=>new Date(b.lastDate)-new Date(a.lastDate));
    }, [patientData, lookupSearch]);

    const lookupSuggestions = useMemo(() => {
        if (!lookupSearch || lookupSearch.length<1) return [];
        const s = lookupSearch.toUpperCase();
        return Object.keys(patientData).filter(r=>r.includes(s)).slice(0,5);
    }, [lookupSearch, patientData]);

    // ── Submit ───────────────────────────────────────────────
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!reg||!vDate||!nvDate) { alert('Please fill all fields'); return; }
        if (!/^\d{4}\/[A-Z]{3}\/\d{4}$/.test(reg)) { alert('Invalid format\n\nExample: 2026/ABC/0001'); return; }
        if (new Date(nvDate)<=new Date(vDate)) { alert('Next Visit must be after Visit Date'); return; }
        const days = calcDays(vDate, nvDate);
        const prev = getTotalTablets(reg);
        setVisits([{ id:Date.now(), regNumber:reg.trim(), visitDate:new Date(vDate), nextVisitDate:new Date(nvDate), tabletDays:days, completed:false, recordedAt:new Date() }, ...visits]);
        showToast(`✓ ${days} days recorded · Total: ${prev+days}d`);
        setReg(''); setVDate(toDateStr(new Date())); setNVDate('');
        setActiveTab('home');
    };

    // ── Actions ──────────────────────────────────────────────
    const toggleDone = (id) => setVisits(visits.map(v => v.id===id ? {...v, completed:!v.completed, completedAt:!v.completed?new Date():null} : v));
    const deleteVisit = (id) => { if(confirm('Delete entry?')) { setVisits(visits.filter(v=>v.id!==id)); showToast('Deleted','info'); }};
    const deletePatient = (reg) => {
        if(confirm(`Delete all data for ${reg}?`)) {
            setVisits(visits.filter(v=>v.regNumber.trim().toUpperCase()!==reg.trim().toUpperCase()));
            showToast('Patient deleted','info');
        }
    };
    const clearAll = () => { if(confirm('Delete ALL data?')) { if(confirm('Cannot be undone. Continue?')) { setVisits([]); localStorage.removeItem(STORAGE_KEY); showToast('Cleared','info'); }}};

    const exportData = () => {
        const b = new Blob([JSON.stringify(visits,null,2)],{type:'application/json'});
        const u = URL.createObjectURL(b); const a=document.createElement('a'); a.href=u;
        a.download=`pt-backup-${toDateStr(new Date())}.json`; a.click(); URL.revokeObjectURL(u);
        showToast('Backup exported');
    };
    const importData = () => {
        const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
        inp.onchange = (e) => {
            const f=e.target.files[0]; if(!f) return;
            const r=new FileReader();
            r.onload=(ev)=>{ try { const d=JSON.parse(ev.target.result); if(!Array.isArray(d)) throw new Error(); setVisits(hydrate(d)); showToast(`Imported ${d.length} records`); } catch { alert('Invalid file'); }};
            r.readAsText(f);
        };
        inp.click();
    };

    const openHistory = (r) => { const p=patientData[r.trim().toUpperCase()]; if(p){setSelPatient(p);setShowHistory(true);} };

    // ── Preview ──────────────────────────────────────────────
    const preview = vDate && nvDate ? calcDays(vDate,nvDate) : null;
    const isExisting = reg && patientData[reg.trim().toUpperCase()];

    // ── Autocomplete ─────────────────────────────────────────
    const AcDropdown = ({ items, onSelect }) => (
        <div className="autocomplete">
            {items.map(s => { const p=patientData[s.toUpperCase()]; return (
                <div key={s} className="ac-item" onMouseDown={()=>onSelect(p.regNumber)}>
                    <span className="ac-reg">{p.regNumber}</span>
                    <span className="ac-meta">💊{p.totalDays}d · {p.visits.length}v</span>
                </div>
            );})}
        </div>
    );

    // ── Panels ───────────────────────────────────────────────
    const HomePanel = () => (
        <>
            {/* Stats */}
            <div className="stats-row">
                <div className="stat-tile highlight" onClick={()=>{ setModalDate(new Date()); }} style={{cursor:'pointer'}}>
                    <div className="st-label">Pending Today</div>
                    <div className="st-value">{pendingToday}</div>
                    <div className="st-sub">patients due</div>
                </div>
                <div className="stat-tile">
                    <div className="st-label">All Patients</div>
                    <div className="st-value">{totalUnique}</div>
                    <div className="st-sub">registered</div>
                </div>
                <div className="stat-tile" onClick={()=>setShowYear(true)} style={{cursor:'pointer'}}>
                    <div className="st-label">This Month</div>
                    <div className="st-value">{countForMonth(curMonth)}</div>
                    <div className="st-sub">{new Date().toLocaleDateString('en-US',{month:'short'})}</div>
                </div>
                <div className="stat-tile">
                    <div className="st-label">Total Entries</div>
                    <div className="st-value">{visits.length}</div>
                    <div className="st-sub">visit records</div>
                </div>
            </div>

            {/* 7-day strip */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Next 7 Days</span>
                </div>
                <div className="upcoming-strip">
                    {sevenDays.map((d,i)=>(
                        <div key={i} className={`uday${d.isToday?' today':''}`} onClick={()=>setModalDate(d.date)}>
                            <div className="uday-name">{d.name}</div>
                            <div className="uday-num">{d.num}</div>
                            <div className="uday-count">{d.count>0?`${d.count}`:'-'}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent patients */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Recent Patients</span>
                    <button className="btn btn-ghost btn-sm" style={{width:'auto',minHeight:'32px'}} onClick={()=>setShowLookup(true)}>All →</button>
                </div>
                {totalUnique===0 ? (
                    <div className="empty-state"><div className="es-icon">📋</div><p>No patients yet</p></div>
                ) : (
                    <div className="patient-list" style={{maxHeight:'260px'}}>
                        {Object.values(patientData).sort((a,b)=>new Date(b.lastDate)-new Date(a.lastDate)).slice(0,8).map(p=>{
                            const latest = p.visits[p.visits.length-1];
                            const pending = p.visits.filter(v=>!v.completed).length;
                            return (
                                <div key={p.regNumber} className="prow" onClick={()=>openHistory(p.regNumber)}>
                                    <span className="preg">{p.regNumber}</span>
                                    <span className="badge bt">💊{p.totalDays}d</span>
                                    <span className={`badge ${pending>0?'ba':'bg'}`}>{pending>0?`⏳${pending}`:'✓'}</span>
                                    <span className="pmeta">{fmtShort(latest.nextVisitDate)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );

    const AssignPanel = () => (
        <div className="card">
            <div className="card-header"><span className="card-title">Assign Tablets</span></div>
            <form onSubmit={handleSubmit}>
                <div className="form-group" style={{position:'relative'}}>
                    <label className="form-label">PT Registration Number</label>
                    <input
                        type="text" className="form-input"
                        value={reg}
                        onChange={e=>{const f=fmtReg(e.target.value); setReg(f); setRegSuggest(f.length>0);}}
                        onFocus={()=>setRegSuggest(true)}
                        onBlur={()=>setTimeout(()=>setRegSuggest(false),200)}
                        placeholder="2026/ABC/0001"
                        maxLength={14} required
                        style={{fontFamily:'var(--font-m)',letterSpacing:'0.02em'}}
                        autoComplete="off"
                        inputMode="text"
                    />
                    {regSuggest && regSuggestions.length>0 && <AcDropdown items={regSuggestions} onSelect={v=>{setReg(v);setRegSuggest(false);}} />}
                    {isExisting && <div className="patient-notice">Returning patient · {getTotalTablets(reg)}d total so far</div>}
                </div>

                <div className="form-group">
                    <label className="form-label">Visit Date</label>
                    <input type="date" className="form-input" value={vDate} onChange={e=>setVDate(e.target.value)} required />
                </div>

                <div className="form-group">
                    <label className="form-label">Next Visit Date</label>
                    <input type="date" className="form-input" value={nvDate} onChange={e=>setNVDate(e.target.value)} required />
                </div>

                {preview !== null && preview > 0 && (
                    <div className="tablet-preview">
                        <div><div className="tp-num">{preview}</div><div className="tp-label">Days</div></div>
                        <div style={{flex:1}}>
                            <div className="tp-sub">Tablets to dispense</div>
                            {isExisting && <div className="tp-sub" style={{marginTop:'0.15rem'}}>New total: {getTotalTablets(reg)+preview}d</div>}
                        </div>
                    </div>
                )}

                <button type="submit" className="btn btn-primary">+ Add Visit Record</button>
            </form>
        </div>
    );

    const CalendarPanel = () => {
        const mv = getMonthViewDays(curMonth);
        return (
            <>
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">{new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
                        <button className="btn btn-ghost btn-sm" style={{width:'auto',minHeight:'32px'}} onClick={()=>setShowYear(true)}>Year →</button>
                    </div>
                    <div className="cal-wdays">
                        {['S','M','T','W','T','F','S'].map((d,i)=><div key={i} className="cal-wday">{d}</div>)}
                    </div>
                    <div className="mini-grid">
                        {miniCalCells.map((c,i)=>{
                            if(!c) return <div key={i}/>;
                            return (
                                <div key={i}
                                    className={`mcell${c.isToday?' today':''}${c.count>0&&!c.isToday?' has-pts':''}${c.isSun?' sunday':''}${c.isPoya&&!c.isToday?' poya':''}`}
                                    onClick={()=>setModalDate(c.date)}
                                    title={c.hol?c.hol.name:`${c.count} patients`}
                                >
                                    <span className="mcell-num">{c.day}</span>
                                    {c.count>0 && <div className="mcell-dot"/>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Full month detail */}
                <div className="card">
                    <div className="card-header"><span className="card-title">Month Detail</span></div>
                    <div className="mvc-wdays">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=><div key={i} className="mvc-wday">{d}</div>)}
                    </div>
                    <div className="mvc-grid">
                        {Array.from({length:mv.firstDOW},(_,i)=><div key={`e${i}`}/>)}
                        {mv.days.map(d=>{
                            let cls='mvc-cell';
                            if(d.isToday) cls+=' today';
                            if(d.isSun) cls+=' sunday';
                            if(d.hol?.type==='poya') cls+=' poya';
                            else if(d.hol) cls+=' holiday';
                            return (
                                <div key={d.day} className={cls} onClick={()=>setModalDate(d.date)}>
                                    <span className="mvc-dname">{d.dayName}</span>
                                    <span className="mvc-dnum">{d.day}</span>
                                    {d.count>0 && <span className="mvc-pt">{d.count} PT</span>}
                                    {d.hol && <span className="mvc-hol">{d.hol.name}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </>
        );
    };

    const RecordsPanel = () => (
        <div className="card">
            <div className="card-header"><span className="card-title">Patient Records</span></div>
            <div className="lookup-stats">
                <div className="lstat"><div className="lstat-val">{totalUnique}</div><div className="lstat-lbl">Patients</div></div>
                <div className="lstat"><div className="lstat-val">{visits.length}</div><div className="lstat-lbl">Entries</div></div>
            </div>
            <div style={{position:'relative',marginBottom:'0.85rem'}}>
                <input type="text" className="form-input" placeholder="Search reg number..."
                    value={lookupSearch}
                    onChange={e=>{setLookupSearch(e.target.value);setLookupSuggest(true);}}
                    onFocus={()=>setLookupSuggest(true)}
                    onBlur={()=>setTimeout(()=>setLookupSuggest(false),200)}
                    style={{fontFamily:'var(--font-m)'}}
                    autoComplete="off"
                />
                {lookupSuggest && lookupSuggestions.length>0 && <AcDropdown items={lookupSuggestions} onSelect={v=>{setLookupSearch(v);setLookupSuggest(false);}} />}
            </div>
            <div className="patient-list" style={{maxHeight:'45vh'}}>
                {lookupResults.length===0 ? (
                    <div className="empty-state"><div className="es-icon">📋</div><p>No patients found</p></div>
                ) : lookupResults.map(p=>{
                    const latest = p.visits[p.visits.length-1];
                    const pending = p.visits.filter(v=>!v.completed).length;
                    return (
                        <div key={p.regNumber} className="lookup-card" onClick={()=>openHistory(p.regNumber)}>
                            <div className="lc-info">
                                <div className="lc-reg">{p.regNumber}</div>
                                <div className="lc-date">Last: {fmtShort(latest.visitDate)} · Next: {fmtShort(latest.nextVisitDate)}</div>
                                <div className="lc-badges">
                                    <span className="badge bt">💊{p.totalDays}d</span>
                                    <span className="badge" style={{background:'rgba(139,92,246,0.1)',color:'#A78BFA',border:'1px solid rgba(139,92,246,0.2)'}}>🔢{p.visits.length}</span>
                                    <span className={`badge ${pending>0?'ba':'bg'}`}>{pending>0?`⏳${pending} pending`:'✓ Done'}</span>
                                </div>
                            </div>
                            <div className="lc-actions" onClick={e=>e.stopPropagation()}>
                                <button className="btn btn-ghost btn-sm" style={{minHeight:'32px',width:'auto'}} onClick={()=>openHistory(p.regNumber)}>History</button>
                                <button className="btn btn-danger btn-sm" style={{minHeight:'32px',width:'auto'}} onClick={()=>deletePatient(p.regNumber)}>✕</button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={{marginTop:'0.85rem'}}>
                <div className="data-acts">
                    <button className="btn btn-ghost" style={{minHeight:'40px',fontSize:'0.72rem'}} onClick={exportData}>📤 Export</button>
                    <button className="btn btn-ghost" style={{minHeight:'40px',fontSize:'0.72rem'}} onClick={importData}>📥 Import</button>
                    {visits.length>0 && <button className="btn btn-danger" style={{minHeight:'40px',fontSize:'0.72rem',flex:'0 0 auto',width:'auto',padding:'0 0.75rem'}} onClick={clearAll}>🗑</button>}
                </div>
            </div>
        </div>
    );

    // ── Render ───────────────────────────────────────────────
    return (
        <div>
            {/* TOAST */}
            {toast && (
                <div className="toast">
                    <span>{toast.type==='success'?'✅':toast.type==='error'?'❌':'ℹ️'}</span>
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* FIXED TOPBAR */}
            <header className="topbar">
                <div className="topbar-brand">
                    <div className="topbar-icon">🫁</div>
                    <div>
                        <div className="topbar-title">PT Tablet Follow-up</div>
                        <div className="topbar-sub">Tablet Distribution Tracker</div>
                    </div>
                </div>
                <div className="topbar-spacer"/>
                <div className="topbar-right">
                    {pendingToday>0 && <div className="topbar-badge">⚡ {pendingToday} today</div>}
                    <div className="topbar-pill"><strong>{totalUnique}</strong> patients</div>
                    <button className="topbar-btn" onClick={()=>setShowLookup(true)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        Records
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div className="app-wrap">
                <div className="app-container">
                    {/* LEFT PANEL — Assign + mini calendar (hidden on mobile unless assign tab) */}
                    <div className={`panel-left${activeTab==='assign'?' tab-active':''}`}>
                        {/* Mobile: only show when assign tab is active */}
                        <div className="mobile-assign-only" style={{display:'contents'}}>
                            <AssignPanel/>
                        </div>
                        {/* Desktop only: mini calendar */}
                        <div className="desktop-only-card">
                            <div className="card">
                                <div className="card-header">
                                    <span className="card-title">{new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
                                    <button className="btn btn-ghost btn-sm" style={{width:'auto',minHeight:'30px'}} onClick={()=>setShowMonth(true)}>Full</button>
                                </div>
                                <div className="cal-wdays">
                                    {['S','M','T','W','T','F','S'].map((d,i)=><div key={i} className="cal-wday">{d}</div>)}
                                </div>
                                <div className="mini-grid">
                                    {miniCalCells.map((c,i)=>{
                                        if(!c) return <div key={i}/>;
                                        return (
                                            <div key={i}
                                                className={`mcell${c.isToday?' today':''}${c.count>0&&!c.isToday?' has-pts':''}${c.isSun?' sunday':''}${c.isPoya&&!c.isToday?' poya':''}`}
                                                onClick={()=>setModalDate(c.date)}
                                            >
                                                <span className="mcell-num">{c.day}</span>
                                                {c.count>0&&<div className="mcell-dot"/>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="card" style={{padding:'0.8rem'}}>
                                <div className="card-title" style={{marginBottom:'0.65rem'}}>Data</div>
                                <div className="data-acts">
                                    <button className="btn btn-ghost" style={{minHeight:'38px',fontSize:'0.72rem'}} onClick={exportData}>📤 Export</button>
                                    <button className="btn btn-ghost" style={{minHeight:'38px',fontSize:'0.72rem'}} onClick={importData}>📥 Import</button>
                                    {visits.length>0&&<button className="btn btn-danger" style={{minHeight:'38px',fontSize:'0.72rem',flex:'0 0 auto',width:'auto',padding:'0 0.7rem'}} onClick={clearAll}>🗑</button>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="panel-right">
                        {/* Mobile: tab-based routing — rendered with CSS visibility for perf */}
                        <div className="tab-home"     style={{display: activeTab==='home'     ? 'contents' : 'none'}}><HomePanel/></div>
                        <div className="tab-calendar" style={{display: activeTab==='calendar' ? 'contents' : 'none'}}><CalendarPanel/></div>
                        <div className="tab-records"  style={{display: activeTab==='records'  ? 'contents' : 'none'}}><RecordsPanel/></div>
                    </div>
                </div>
            </div>

            {/* BOTTOM NAV (mobile) */}
            <nav className="bottom-nav">
                <div className="bottom-nav-inner">
                    {[
                        { id:'home',     icon:'🏠', label:'Home'     },
                        { id:'assign',   icon:'💊', label:'Assign',  badge: null },
                        { id:'calendar', icon:'📅', label:'Calendar' },
                        { id:'records',  icon:'🔍', label:'Records'  },
                    ].map(t=>(
                        <button key={t.id} className={`bn-tab${activeTab===t.id?' active':''}`} onClick={()=>setActiveTab(t.id)}>
                            <span className="bn-tab-icon">{t.icon}</span>
                            {pendingToday>0 && t.id==='home' && <span className="bn-badge">{pendingToday}</span>}
                            {t.label}
                        </button>
                    ))}
                </div>
            </nav>

            {/* ── MODALS ───────────────────────────────── */}

            {/* Date Patients */}
            {modalDate && (
                <div className="modal-overlay" onClick={()=>setModalDate(null)}>
                    <div className="modal" onClick={e=>e.stopPropagation()}>
                        <div className="modal-handle"/>
                        <div className="modal-head">
                            <div className="modal-title">📋 {new Date(modalDate).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
                            <button className="modal-close" onClick={()=>setModalDate(null)}>×</button>
                        </div>
                        {patientsForDate(modalDate).length===0 ? (
                            <div className="empty-state"><div className="es-icon">📋</div><p>No patients on this day</p></div>
                        ) : (
                            <>
                                <div style={{background:'var(--teal-soft)',border:'1px solid var(--border-2)',borderRadius:'var(--radius-sm)',padding:'0.55rem 0.8rem',marginBottom:'0.85rem',fontSize:'0.75rem',color:'var(--txt-2)'}}>
                                    <strong style={{color:'var(--teal)'}}>{new Set(patientsForDate(modalDate).filter(v=>!v.completed).map(v=>v.regNumber.trim().toUpperCase())).size}</strong> pending
                                </div>
                                <div className="patient-list" style={{maxHeight:'55vh'}}>
                                    {patientsForDate(modalDate).map(v=>(
                                        <div key={v.id} className={`prow${v.completed?' done':''}`}>
                                            <span className="preg">{v.regNumber}</span>
                                            <span className="pmeta" style={{flex:1}}>{v.completed?'✓ Done':'Pending'}</span>
                                            <input type="checkbox" className="checkbox" checked={v.completed} onChange={()=>toggleDone(v.id)}/>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Month Full View */}
            {showMonth && (
                <div className="modal-overlay" onClick={()=>setShowMonth(false)}>
                    <div className="modal xl" onClick={e=>e.stopPropagation()}>
                        <div className="modal-handle"/>
                        <div className="modal-head">
                            <div className="modal-title">{new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
                            <button className="modal-close" onClick={()=>setShowMonth(false)}>×</button>
                        </div>
                        {(()=>{const mv=getMonthViewDays(curMonth); return (
                            <>
                                <div className="mvc-wdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=><div key={i} className="mvc-wday">{d}</div>)}</div>
                                <div className="mvc-grid">
                                    {Array.from({length:mv.firstDOW},(_,i)=><div key={`e${i}`}/>)}
                                    {mv.days.map(d=>{
                                        let cls='mvc-cell';
                                        if(d.isToday) cls+=' today';
                                        if(d.isSun) cls+=' sunday';
                                        if(d.hol?.type==='poya') cls+=' poya'; else if(d.hol) cls+=' holiday';
                                        return (
                                            <div key={d.day} className={cls} onClick={()=>{setModalDate(d.date);setShowMonth(false);}}>
                                                <span className="mvc-dname">{d.dayName}</span>
                                                <span className="mvc-dnum">{d.day}</span>
                                                {d.count>0&&<span className="mvc-pt">{d.count} PT</span>}
                                                {d.hol&&<span className="mvc-hol">{d.hol.name}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        );})()}
                    </div>
                </div>
            )}

            {/* Year View */}
            {showYear && (
                <div className="modal-overlay" onClick={()=>setShowYear(false)}>
                    <div className="modal wide" onClick={e=>e.stopPropagation()}>
                        <div className="modal-handle"/>
                        <div className="modal-head">
                            <div className="modal-title">Year Overview — {curYear}</div>
                            <button className="modal-close" onClick={()=>setShowYear(false)}>×</button>
                        </div>
                        <div className="year-grid">
                            {MONTHS.map((m,i)=>{const c=countForMonth(i); return (
                                <div key={m} className="year-cell">
                                    <div className="year-mname">{m.slice(0,3)}</div>
                                    <div className={`year-count${c>0?' has':''}`}>{c}</div>
                                </div>
                            );})}
                        </div>
                        <div style={{marginTop:'0.85rem',textAlign:'center',padding:'0.9rem',background:'var(--teal-soft)',border:'1px solid var(--border-2)',borderRadius:'var(--radius-sm)'}}>
                            <div style={{fontSize:'0.6rem',color:'var(--txt-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.25rem'}}>Total Unique Patients</div>
                            <div style={{fontFamily:'var(--font-d)',fontSize:'2.2rem',fontWeight:800,color:'var(--teal)'}}>{totalUnique}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lookup */}
            {showLookup && (
                <div className="modal-overlay" onClick={()=>setShowLookup(false)}>
                    <div className="modal wide" onClick={e=>e.stopPropagation()}>
                        <div className="modal-handle"/>
                        <div className="modal-head">
                            <div className="modal-title">Patient Records</div>
                            <button className="modal-close" onClick={()=>setShowLookup(false)}>×</button>
                        </div>
                        <div className="lookup-stats">
                            <div className="lstat"><div className="lstat-val">{totalUnique}</div><div className="lstat-lbl">Patients</div></div>
                            <div className="lstat"><div className="lstat-val">{visits.length}</div><div className="lstat-lbl">Entries</div></div>
                        </div>
                        <div style={{position:'relative',marginBottom:'0.85rem'}}>
                            <input type="text" className="form-input" placeholder="Search registration number..."
                                value={lookupSearch}
                                onChange={e=>{setLookupSearch(e.target.value);setLookupSuggest(true);}}
                                onFocus={()=>setLookupSuggest(true)}
                                onBlur={()=>setTimeout(()=>setLookupSuggest(false),200)}
                                autoFocus style={{fontFamily:'var(--font-m)'}} autoComplete="off"
                            />
                            {lookupSuggest&&lookupSuggestions.length>0&&<AcDropdown items={lookupSuggestions} onSelect={v=>{setLookupSearch(v);setLookupSuggest(false);}}/>}
                        </div>
                        <div className="patient-list" style={{maxHeight:'50vh'}}>
                            {lookupResults.length===0?(
                                <div className="empty-state"><div className="es-icon">📋</div><p>No patients found</p></div>
                            ):lookupResults.map(p=>{
                                const latest=p.visits[p.visits.length-1];
                                const pending=p.visits.filter(v=>!v.completed).length;
                                return (
                                    <div key={p.regNumber} className="lookup-card" onClick={()=>{openHistory(p.regNumber);setShowLookup(false);}}>
                                        <div className="lc-info">
                                            <div className="lc-reg">{p.regNumber}</div>
                                            <div className="lc-date">Last: {fmtShort(latest.visitDate)} · Next: {fmtShort(latest.nextVisitDate)}</div>
                                            <div className="lc-badges">
                                                <span className="badge bt">💊{p.totalDays}d</span>
                                                <span className="badge" style={{background:'rgba(139,92,246,0.1)',color:'#A78BFA',border:'1px solid rgba(139,92,246,0.2)'}}>🔢{p.visits.length}</span>
                                                <span className={`badge ${pending>0?'ba':'bg'}`}>{pending>0?`⏳${pending}`:'✓'}</span>
                                            </div>
                                        </div>
                                        <div className="lc-actions" onClick={e=>e.stopPropagation()}>
                                            <button className="btn btn-ghost btn-sm" style={{minHeight:'30px',width:'auto'}} onClick={()=>{openHistory(p.regNumber);setShowLookup(false);}}>Hist</button>
                                            <button className="btn btn-danger btn-sm" style={{minHeight:'30px',width:'auto'}} onClick={()=>deletePatient(p.regNumber)}>✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{marginTop:'0.85rem'}}>
                            <div className="data-acts">
                                <button className="btn btn-ghost" style={{minHeight:'40px',fontSize:'0.75rem'}} onClick={exportData}>📤 Export</button>
                                <button className="btn btn-ghost" style={{minHeight:'40px',fontSize:'0.75rem'}} onClick={importData}>📥 Import</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Patient History */}
            {showHistory && selPatient && (
                <div className="modal-overlay" onClick={()=>setShowHistory(false)}>
                    <div className="modal" onClick={e=>e.stopPropagation()}>
                        <div className="modal-handle"/>
                        <div className="modal-head">
                            <div className="modal-title">📊 {selPatient.regNumber}</div>
                            <button className="modal-close" onClick={()=>setShowHistory(false)}>×</button>
                        </div>
                        <div className="hist-head">
                            <div><div className="hl">Total Tablets</div><div className="hv">{selPatient.totalDays}</div><div className="hs">days</div></div>
                            <div><div className="hl">Visits</div><div className="hv">{selPatient.visits.length}</div><div className="hs">total</div></div>
                        </div>
                        <div className="sec-label">Visit History</div>
                        <div className="patient-list" style={{maxHeight:'45vh'}}>
                            {[...selPatient.visits].reverse().map(v=>(
                                <div key={v.id} className="visit-card">
                                    <div>
                                        <div className="vc-dt">{fmt(v.visitDate)}</div>
                                        <div className="vc-nxt">Next: {fmt(v.nextVisitDate)}</div>
                                        <div className="vc-st" style={{color:v.completed?'var(--emerald)':'var(--amber)'}}>{v.completed?'✅ Completed':'⏳ Pending'}</div>
                                    </div>
                                    <div style={{textAlign:'right',flexShrink:0}}>
                                        <div className="vc-days">{v.tabletDays}d</div>
                                        <div className="vc-dlbl">tablets</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{marginTop:'0.85rem',padding:'0.8rem',background:'var(--teal-soft)',border:'1px solid var(--border-2)',borderRadius:'var(--radius-sm)',textAlign:'center'}}>
                            <div style={{fontSize:'0.6rem',color:'var(--txt-3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:'0.22rem'}}>Treatment Duration</div>
                            <div style={{fontSize:'0.85rem',fontWeight:600,color:'var(--teal)'}}>{fmtShort(selPatient.firstDate)} → {fmtShort(selPatient.lastNext)}</div>
                            <div style={{fontSize:'0.68rem',color:'var(--txt-3)',marginTop:'0.15rem'}}>{Math.ceil((new Date(selPatient.lastNext)-new Date(selPatient.firstDate))/86400000)} days</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PTVisitTracker/>);
