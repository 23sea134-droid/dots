// ============================================================
// PT TABLET FOLLOW-UP — Redesigned App
// Local Storage Edition (reliable, no Google dependency)
// ============================================================

const { useState, useEffect, useMemo, useCallback, useRef } = React;
const STORAGE_KEY = 'ptVisits_v3';

function PTVisitTracker() {
    const [visits, setVisits] = useState([]);
    const [regNumber, setRegNumber] = useState('');
    const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
    const [nextVisitDate, setNextVisitDate] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [showMonthCalendar, setShowMonthCalendar] = useState(false);
    const [showYearView, setShowYearView] = useState(false);
    const [showLookup, setShowLookup] = useState(false);
    const [lookupSearch, setLookupSearch] = useState('');
    const [showPatientHistory, setShowPatientHistory] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showRegSuggestions, setShowRegSuggestions] = useState(false);
    const [showLookupSuggestions, setShowLookupSuggestions] = useState(false);
    const [toast, setToast] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

    // ---- Load local data on mount ----
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setVisits(parsed.map(v => ({
                    ...v,
                    visitDate: new Date(v.visitDate),
                    nextVisitDate: new Date(v.nextVisitDate),
                    recordedAt: new Date(v.recordedAt),
                    completedAt: v.completedAt ? new Date(v.completedAt) : null,
                    tabletDays: v.tabletDays || 0
                })));
            }
        } catch (e) { console.error('Load error:', e); }
    }, []);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const saveVisits = useCallback((updatedVisits) => {
        setVisits(updatedVisits);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVisits));
        } catch (e) { console.error('Save error:', e); }
    }, []);

    // ---- Computations ----
    const patientTabletData = useMemo(() => {
        const data = {};
        visits.forEach(v => {
            const reg = v.regNumber.trim().toUpperCase();
            if (!data[reg]) data[reg] = { regNumber: v.regNumber, totalTabletDays: 0, visits: [], firstVisitDate: v.visitDate, lastVisitDate: v.visitDate, lastNextVisitDate: v.nextVisitDate };
            const p = data[reg];
            p.totalTabletDays += v.tabletDays;
            p.visits.push(v);
            if (new Date(v.visitDate) < new Date(p.firstVisitDate)) p.firstVisitDate = v.visitDate;
            if (new Date(v.visitDate) > new Date(p.lastVisitDate)) p.lastVisitDate = v.visitDate;
            if (new Date(v.nextVisitDate) > new Date(p.lastNextVisitDate)) p.lastNextVisitDate = v.nextVisitDate;
        });
        Object.values(data).forEach(p => p.visits.sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate)));
        return data;
    }, [visits]);

    const getPatientTotalTablets = useCallback((reg) => patientTabletData[reg.trim().toUpperCase()]?.totalTabletDays || 0, [patientTabletData]);
    const calculateTabletDays = (vDate, nDate) => { const d = Math.ceil((new Date(nDate) - new Date(vDate)) / 86400000); return d > 0 ? d : 0; };

    const uniquePatientCounts = useMemo(() => {
        const counts = { byMonth: {}, byDate: {}, total: new Set() };
        visits.forEach(v => {
            const d = new Date(v.nextVisitDate);
            const month = d.getMonth();
            const dateKey = d.toDateString();
            const reg = v.regNumber.trim().toUpperCase();
            counts.total.add(reg);
            if (!counts.byMonth[month]) counts.byMonth[month] = new Set();
            if (!counts.byDate[dateKey]) counts.byDate[dateKey] = new Set();
            if (!v.completed) { counts.byMonth[month].add(reg); counts.byDate[dateKey].add(reg); }
        });
        return {
            byMonth: Object.fromEntries(Object.entries(counts.byMonth).map(([k, v]) => [k, v.size])),
            byDate: Object.fromEntries(Object.entries(counts.byDate).map(([k, v]) => [k, v.size])),
            total: counts.total.size
        };
    }, [visits]);

    const getUniquePatientsForDate = useCallback((date) => uniquePatientCounts.byDate[new Date(date).toDateString()] || 0, [uniquePatientCounts]);
    const getUniquePatientsForMonth = useCallback((m) => uniquePatientCounts.byMonth[m] || 0, [uniquePatientCounts]);

    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formatShort = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const formatRegNumber = (value) => {
        let c = value.replace(/[^a-zA-Z0-9]/g, '');
        let f = c.slice(0, 4);
        if (c.length > 4) f += '/' + c.slice(4, 7).toUpperCase();
        if (c.length > 7) f += '/' + c.slice(7, 11);
        return f;
    };

    const handleRegNumberChange = (e) => { const f = formatRegNumber(e.target.value); setRegNumber(f); setShowRegSuggestions(f.length > 0); };

    const getRegSuggestions = useCallback((term) => {
        if (!term || term.length < 1) return [];
        const s = term.toUpperCase().trim();
        return Object.keys(patientTabletData).filter(r => r.toUpperCase().includes(s)).slice(0, 6);
    }, [patientTabletData]);

    const regNumberSuggestions = useMemo(() => getRegSuggestions(regNumber), [regNumber, getRegSuggestions]);
    const lookupSuggestions = useMemo(() => getRegSuggestions(lookupSearch), [lookupSearch, getRegSuggestions]);

    const getPatientsForDate = (date) => {
        const target = new Date(date); target.setHours(0, 0, 0, 0);
        return visits.filter(v => { const d = new Date(v.nextVisitDate); d.setHours(0, 0, 0, 0); return d.getTime() === target.getTime(); });
    };

    const getTodayPatients = () => { const today = new Date(); today.setHours(0, 0, 0, 0); return visits.filter(v => { const d = new Date(v.nextVisitDate); d.setHours(0, 0, 0, 0); return d.getTime() === today.getTime(); }); };
    const getPendingTodayCount = () => new Set(getTodayPatients().filter(v => !v.completed).map(v => v.regNumber.trim().toUpperCase())).size;

    const getMonthDays = useCallback((monthIndex) => {
        const year = new Date().getFullYear();
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = [];
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, monthIndex, day); date.setHours(0, 0, 0, 0);
            const pending = visits.filter(v => { const d = new Date(v.nextVisitDate); d.setHours(0, 0, 0, 0); return d.getTime() === date.getTime() && !v.completed; });
            days.push({
                date, day,
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                count: new Set(pending.map(v => v.regNumber.trim().toUpperCase())).size,
                holiday: getHolidayForDate(date),
                isToday: date.getTime() === today.getTime(),
                isSunday: date.getDay() === 0,
                dayOfWeek: date.getDay()
            });
        }
        return days;
    }, [visits]);

    // ---- CRUD ----
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!regNumber || !visitDate || !nextVisitDate) { alert('Please fill in all required fields'); return; }
        if (!/^\d{4}\/[A-Z]{3}\/\d{4}$/.test(regNumber)) { alert('Invalid format!\n\nRequired: YYYY/AAA/0000\nExample: 2026/ABC/0001'); return; }
        if (new Date(nextVisitDate) <= new Date(visitDate)) { alert('Next Visit Date must be after Visit Date'); return; }
        const tabletDays = calculateTabletDays(visitDate, nextVisitDate);
        const currentTotal = getPatientTotalTablets(regNumber);
        const newVisit = {
            id: Date.now(),
            regNumber: regNumber.trim(),
            visitDate: new Date(visitDate),
            nextVisitDate: new Date(nextVisitDate),
            tabletDays,
            completed: false,
            recordedAt: new Date()
        };
        saveVisits([newVisit, ...visits]);
        showToast(`✓ Recorded — ${tabletDays} days (Total: ${currentTotal + tabletDays})`);
        setRegNumber('');
        setVisitDate(new Date().toISOString().split('T')[0]);
        setNextVisitDate('');
    };

    const deleteVisit = (id) => { if (confirm('Delete this entry?')) { saveVisits(visits.filter(v => v.id !== id)); showToast('Entry deleted', 'info'); } };
    const clearAllData = () => { if (confirm('⚠️ Delete ALL patient data permanently?')) { if (confirm('This cannot be undone. Proceed?')) { saveVisits([]); localStorage.removeItem(STORAGE_KEY); showToast('All data cleared', 'info'); } } };
    const toggleCompleted = (id) => saveVisits(visits.map(v => v.id === id ? { ...v, completed: !v.completed, completedAt: !v.completed ? new Date() : null } : v));

    const exportData = () => {
        const blob = new Blob([JSON.stringify(visits, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
        a.download = `pt-tablet-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
        showToast('Backup exported');
    };

    const importData = () => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    if (!Array.isArray(imported)) throw new Error('Invalid');
                    saveVisits(imported.map(v => ({ ...v, visitDate: new Date(v.visitDate), nextVisitDate: new Date(v.nextVisitDate), recordedAt: new Date(v.recordedAt), completedAt: v.completedAt ? new Date(v.completedAt) : null, tabletDays: v.tabletDays || 0 })));
                    showToast(`Imported ${imported.length} records`);
                } catch (err) { alert('Invalid backup file.'); }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const openPatientHistory = (reg) => { const p = patientTabletData[reg.trim().toUpperCase()]; if (p) { setSelectedPatient(p); setShowPatientHistory(true); } };

    const currentYear = new Date().getFullYear();
    const pendingToday = getPendingTodayCount();
    const tabletPreview = visitDate && nextVisitDate ? calculateTabletDays(visitDate, nextVisitDate) : null;
    const currentTotal = regNumber ? getPatientTotalTablets(regNumber) : 0;
    const isExistingPatient = regNumber && patientTabletData[regNumber.trim().toUpperCase()];

    // 7-day upcoming
    const upcomingDays = Array.from({ length: 7 }, (_, i) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const d = new Date(today); d.setDate(today.getDate() + i);
        const isToday = i === 0;
        return {
            isToday,
            dayName: isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNum: d.getDate(),
            count: getUniquePatientsForDate(d),
            fullDate: d,
            month: d.toLocaleDateString('en-US', { month: 'short' })
        };
    });

    // Current month mini calendar
    const currentMonthDays = useMemo(() => {
        const year = currentYear;
        const month = new Date().getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const today = new Date(); today.setHours(0,0,0,0);
        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= lastDay; d++) {
            const date = new Date(year, month, d); date.setHours(0,0,0,0);
            const h = getHolidayForDate(date);
            cells.push({
                day: d, date,
                count: getUniquePatientsForDate(date),
                isToday: date.getTime() === today.getTime(),
                isSunday: date.getDay() === 0,
                isPoya: h?.type === 'poya',
                holiday: h
            });
        }
        return cells;
    }, [visits, currentYear]);

    const modalPatients = selectedDate ? getPatientsForDate(selectedDate) : [];
    const modalDateStr = selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';

    const AutocompleteDropdown = ({ items, onSelect }) => (
        <div className="autocomplete">
            {items.map(s => {
                const p = patientTabletData[s.toUpperCase()];
                return (
                    <div key={s} className="autocomplete-item" onMouseDown={() => onSelect(p.regNumber)}>
                        <span className="autocomplete-item-reg">{p.regNumber}</span>
                        <span className="autocomplete-item-meta">💊 {p.totalTabletDays}d · {p.visits.length} visits</span>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div>
            {/* TOAST */}
            {toast && (
                <div className="toast">
                    <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* ====== FIXED TOPBAR ====== */}
            <header className="topbar">
                <div className="topbar-brand">
                    <div className="topbar-icon">🫁</div>
                    <div>
                        <div className="topbar-title">PT Tablet Follow-up</div>
                        <div className="topbar-subtitle">Tablet Distribution Tracker</div>
                    </div>
                </div>
                <div className="topbar-spacer" />
                <div className="topbar-stats">
                    {pendingToday > 0 && (
                        <div className="topbar-today-badge">
                            <span>⚡</span>
                            <span>{pendingToday} today</span>
                        </div>
                    )}
                    <div className="topbar-pill">
                        <strong>{visits.length > 0 ? Object.keys(patientTabletData).length : 0}</strong>
                        <span>patients</span>
                    </div>
                    <button className="topbar-btn" onClick={() => setShowLookup(true)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        Patient Records
                    </button>
                </div>
            </header>

            {/* ====== MAIN LAYOUT ====== */}
            <div className="app-container">
                {/* LEFT PANEL */}
                <div className="panel-left">
                    {/* Assign Tablets */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Assign Tablets</span>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label className="form-label">PT Registration No.</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={regNumber}
                                    onChange={handleRegNumberChange}
                                    onFocus={() => setShowRegSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowRegSuggestions(false), 200)}
                                    placeholder="2026/ABC/0001"
                                    maxLength={14}
                                    required
                                    autoFocus
                                    style={{ fontFamily: 'var(--font-m)', letterSpacing: '0.02em' }}
                                />
                                {showRegSuggestions && regNumberSuggestions.length > 0 && (
                                    <AutocompleteDropdown items={regNumberSuggestions} onSelect={v => { setRegNumber(v); setShowRegSuggestions(false); }} />
                                )}
                                {isExistingPatient && (
                                    <div className="patient-notice" style={{ marginTop: '0.5rem' }}>
                                        Returning patient · {currentTotal}d total so far
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Visit Date</label>
                                <input type="date" className="form-input" value={visitDate} onChange={e => setVisitDate(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Next Visit Date</label>
                                <input type="date" className="form-input" value={nextVisitDate} onChange={e => setNextVisitDate(e.target.value)} required />
                            </div>

                            {tabletPreview !== null && tabletPreview > 0 && (
                                <div className="tablet-preview">
                                    <div>
                                        <div className="tablet-preview-days">{tabletPreview}</div>
                                        <div className="tablet-preview-label">Days</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="tablet-preview-sub">Tablets to dispense</div>
                                        {isExistingPatient && (
                                            <div className="tablet-preview-sub" style={{ marginTop: '0.2rem', color: 'var(--teal)' }}>
                                                New total: {currentTotal + tabletPreview}d
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="btn btn-primary" style={{ marginBottom: '0.5rem' }}>
                                + Add Visit Record
                            </button>
                        </form>
                    </div>

                    {/* Current Month Mini Calendar */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                            <button
                                className="btn btn-ghost btn-small"
                                style={{ width: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}
                                onClick={() => setShowMonthCalendar(true)}
                            >Full View</button>
                        </div>
                        <div className="cal-weekdays">
                            {['S','M','T','W','T','F','S'].map((d,i) => (
                                <div key={i} className="cal-weekday">{d}</div>
                            ))}
                        </div>
                        <div className="month-mini-grid">
                            {currentMonthDays.map((cell, i) => {
                                if (!cell) return <div key={i} />;
                                return (
                                    <div
                                        key={i}
                                        className={`month-cell ${cell.isToday ? 'today' : ''} ${cell.count > 0 && !cell.isToday ? 'has-patients' : ''} ${cell.isSunday ? 'sunday' : ''} ${cell.isPoya && !cell.isToday ? 'poya' : ''}`}
                                        onClick={() => { setSelectedDate(cell.date); setShowModal(true); }}
                                        title={cell.holiday ? cell.holiday.name : `${cell.count} patients`}
                                    >
                                        <span className="month-cell-num">{cell.day}</span>
                                        {cell.count > 0 && <div className="month-cell-dot" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Data Actions */}
                    <div className="card" style={{ padding: '0.85rem 1.1rem' }}>
                        <div className="card-title" style={{ marginBottom: '0.75rem', fontSize: '0.72rem' }}>Data Management</div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-small" onClick={exportData} style={{ flex: 1 }}>📤 Export</button>
                            <button className="btn btn-ghost btn-small" onClick={importData} style={{ flex: 1 }}>📥 Import</button>
                            {visits.length > 0 && <button className="btn btn-danger btn-small" onClick={clearAllData}>🗑</button>}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="panel-right">
                    {/* Stats Row */}
                    <div className="stats-row">
                        <div className="stat-tile highlight" onClick={() => { setSelectedDate(new Date()); setShowModal(true); }} style={{ cursor: 'pointer' }}>
                            <div className="stat-tile-label">Pending Today</div>
                            <div className="stat-tile-value">{pendingToday}</div>
                            <div className="stat-tile-sub">patients due</div>
                        </div>
                        <div className="stat-tile">
                            <div className="stat-tile-label">Total Patients</div>
                            <div className="stat-tile-value">{Object.keys(patientTabletData).length}</div>
                            <div className="stat-tile-sub">registered</div>
                        </div>
                        <div className="stat-tile" onClick={() => setShowYearView(true)} style={{ cursor: 'pointer' }}>
                            <div className="stat-tile-label">This Month</div>
                            <div className="stat-tile-value">{getUniquePatientsForMonth(new Date().getMonth())}</div>
                            <div className="stat-tile-sub">{new Date().toLocaleDateString('en-US', { month: 'short' })}</div>
                        </div>
                        <div className="stat-tile">
                            <div className="stat-tile-label">Total Entries</div>
                            <div className="stat-tile-value">{visits.length}</div>
                            <div className="stat-tile-sub">visit records</div>
                        </div>
                    </div>

                    {/* 7 Day Upcoming */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">7-Day Schedule</span>
                        </div>
                        <div className="upcoming-strip">
                            {upcomingDays.map((d, i) => (
                                <div
                                    key={i}
                                    className={`upcoming-day ${d.isToday ? 'is-today' : ''}`}
                                    onClick={() => { setSelectedDate(d.fullDate); setShowModal(true); }}
                                >
                                    <div className="upcoming-day-name">{d.dayName}</div>
                                    <div className="upcoming-day-num">{d.dayNum}</div>
                                    <div className="upcoming-day-count">{d.count > 0 ? `${d.count} PT` : '—'}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Patients */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Recent Patients</span>
                            <button className="btn btn-ghost btn-small" style={{ width: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.7rem' }} onClick={() => setShowLookup(true)}>
                                View All
                            </button>
                        </div>
                        {Object.keys(patientTabletData).length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📋</div>
                                <p>No patient records yet</p>
                            </div>
                        ) : (
                            <div className="patient-list">
                                {Object.values(patientTabletData)
                                    .sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate))
                                    .slice(0, 10)
                                    .map(patient => {
                                        const latest = patient.visits[patient.visits.length - 1];
                                        const pending = patient.visits.filter(v => !v.completed).length;
                                        return (
                                            <div key={patient.regNumber} className="patient-row" onClick={() => openPatientHistory(patient.regNumber)}>
                                                <span className="patient-reg">{patient.regNumber}</span>
                                                <span className="patient-badge badge-teal">💊 {patient.totalTabletDays}d</span>
                                                <span className={`patient-badge ${pending > 0 ? 'badge-amber' : 'badge-emerald'}`}>
                                                    {pending > 0 ? `⏳ ${pending}` : '✓'}
                                                </span>
                                                <span className="patient-meta">{formatShort(latest.nextVisitDate)}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ====== MODALS ====== */}

            {/* Date Patients Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-head">
                            <div className="modal-title">📋 {modalDateStr}</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        {modalPatients.length === 0 ? (
                            <div className="empty-state"><div className="empty-state-icon">📋</div><p>No patients scheduled</p></div>
                        ) : (
                            <>
                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.9rem', marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--txt-2)' }}>
                                    <strong style={{ color: 'var(--teal)' }}>{new Set(modalPatients.filter(v => !v.completed).map(v => v.regNumber.trim().toUpperCase())).size}</strong> patients pending
                                </div>
                                <div className="patient-list" style={{ maxHeight: '400px' }}>
                                    {modalPatients.map(visit => (
                                        <div key={visit.id} className={`patient-row ${visit.completed ? 'completed' : ''}`}>
                                            <span className="patient-reg">{visit.regNumber}</span>
                                            <span className="patient-meta" style={{ flex: 1 }}>{visit.completed ? '✓ Done' : 'Pending'}</span>
                                            <input type="checkbox" className="checkbox" checked={visit.completed} onChange={() => toggleCompleted(visit.id)} />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Current Month Full Calendar Modal */}
            {showMonthCalendar && (
                <div className="modal-overlay" onClick={() => setShowMonthCalendar(false)}>
                    <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
                        <div className="modal-head">
                            <div className="modal-title">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                            <button className="modal-close" onClick={() => setShowMonthCalendar(false)}>×</button>
                        </div>
                        <div className="cal-weekdays" style={{ marginBottom: '0.35rem' }}>
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) => (
                                <div key={i} className="cal-weekday">{d}</div>
                            ))}
                        </div>
                        <div className="month-view-grid">
                            {/* Fill empty cells for start of month */}
                            {Array.from({ length: new Date(currentYear, new Date().getMonth(), 1).getDay() }, (_, i) => (
                                <div key={`empty-${i}`} />
                            ))}
                            {getMonthDays(new Date().getMonth()).map(d => {
                                let cls = 'mvc-day';
                                if (d.isToday) cls += ' today';
                                if (d.isSunday) cls += ' sunday';
                                if (d.holiday?.type === 'poya') cls += ' poya';
                                else if (d.holiday) cls += ' holiday';
                                return (
                                    <div key={d.day} className={cls} onClick={() => { setSelectedDate(d.date); setShowModal(true); setShowMonthCalendar(false); }}>
                                        <span className="mvc-day-name">{d.dayName}</span>
                                        <span className="mvc-day-num">{d.day}</span>
                                        {d.count > 0 && <span className="mvc-pt">{d.count} PT</span>}
                                        {d.holiday && <span className="mvc-hol">{d.holiday.name}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Year View Modal */}
            {showYearView && (
                <div className="modal-overlay" onClick={() => setShowYearView(false)}>
                    <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
                        <div className="modal-head">
                            <div className="modal-title">Year Overview — {currentYear}</div>
                            <button className="modal-close" onClick={() => setShowYearView(false)}>×</button>
                        </div>
                        <div className="year-grid">
                            {MONTHS.map((month, index) => {
                                const count = getUniquePatientsForMonth(index);
                                return (
                                    <div key={month} className="year-month-cell" onClick={() => { setSelectedMonth(index); setShowYearView(false); setShowMonthCalendar(false); /* open month view */ }}>
                                        <div className="year-month-name">{month.slice(0, 3)}</div>
                                        <div className="year-month-count" style={{ color: count > 0 ? 'var(--teal)' : 'var(--txt-3)' }}>{count}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: '1rem', textAlign: 'center', padding: '1rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Total Unique Patients</div>
                            <div style={{ fontFamily: 'var(--font-d)', fontSize: '2.5rem', fontWeight: 800, color: 'var(--teal)' }}>{Object.keys(patientTabletData).length}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lookup Modal */}
            {showLookup && (
                <div className="modal-overlay" onClick={() => setShowLookup(false)}>
                    <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
                        <div className="modal-head">
                            <div className="modal-title">Patient Records</div>
                            <button className="modal-close" onClick={() => setShowLookup(false)}>×</button>
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                            {[
                                { label: 'Unique Patients', val: Object.keys(patientTabletData).length },
                                { label: 'Total Entries', val: visits.length }
                            ].map(s => (
                                <div key={s.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--teal)' }}>{s.val}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="lookup-search-wrap">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search by registration number..."
                                value={lookupSearch}
                                onChange={e => { setLookupSearch(e.target.value); setShowLookupSuggestions(true); }}
                                onFocus={() => setShowLookupSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowLookupSuggestions(false), 200)}
                                autoFocus
                                style={{ fontFamily: 'var(--font-m)' }}
                            />
                            {showLookupSuggestions && lookupSuggestions.length > 0 && (
                                <AutocompleteDropdown items={lookupSuggestions} onSelect={v => { setLookupSearch(v); setShowLookupSuggestions(false); }} />
                            )}
                        </div>

                        {/* Patient List */}
                        <div className="patient-list" style={{ maxHeight: '380px' }}>
                            {(() => {
                                const filtered = Object.values(patientTabletData).filter(p =>
                                    !lookupSearch.trim() || p.regNumber.toUpperCase().includes(lookupSearch.trim().toUpperCase())
                                );
                                if (filtered.length === 0) return <div className="empty-state"><div className="empty-state-icon">📋</div><p>No patients found</p></div>;
                                return filtered
                                    .sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate))
                                    .map(patient => {
                                        const latest = patient.visits[patient.visits.length - 1];
                                        const pending = patient.visits.filter(v => !v.completed).length;
                                        return (
                                            <div key={patient.regNumber} className="lookup-patient-card">
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontFamily: 'var(--font-m)', fontSize: '0.88rem', color: 'var(--teal)', marginBottom: '0.2rem' }}>{patient.regNumber}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--txt-3)' }}>
                                                        Last: {formatDate(latest.visitDate)} · Next: {formatDate(latest.nextVisitDate)}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                                                        <span className="patient-badge badge-teal">💊 {patient.totalTabletDays}d</span>
                                                        <span className="patient-badge" style={{ background: 'rgba(139,100,193,0.1)', color: '#A78BFA', border: '1px solid rgba(139,100,193,0.2)' }}>🔢 {patient.visits.length}</span>
                                                        <span className={`patient-badge ${pending > 0 ? 'badge-amber' : 'badge-emerald'}`}>{pending > 0 ? `⏳ ${pending} pending` : '✓ Done'}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                                    <button className="btn btn-ghost btn-small" onClick={() => openPatientHistory(patient.regNumber)}>History</button>
                                                    <button className="btn btn-danger btn-small" onClick={() => {
                                                        if (confirm(`Delete all data for ${patient.regNumber}?`)) {
                                                            saveVisits(visits.filter(v => v.regNumber.trim().toUpperCase() !== patient.regNumber.trim().toUpperCase()));
                                                            showToast('Patient deleted');
                                                        }
                                                    }}>✕</button>
                                                </div>
                                            </div>
                                        );
                                    });
                            })()}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={exportData}>📤 Export Backup</button>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={importData}>📥 Import Backup</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Patient History Modal */}
            {showPatientHistory && selectedPatient && (
                <div className="modal-overlay" onClick={() => setShowPatientHistory(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-head">
                            <div className="modal-title">📊 {selectedPatient.regNumber}</div>
                            <button className="modal-close" onClick={() => setShowPatientHistory(false)}>×</button>
                        </div>
                        <div className="history-header">
                            <div>
                                <div className="history-stat-label">Total Tablets</div>
                                <div className="history-stat-value">{selectedPatient.totalTabletDays}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--txt-3)' }}>days</div>
                            </div>
                            <div>
                                <div className="history-stat-label">Total Visits</div>
                                <div className="history-stat-value">{selectedPatient.visits.length}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--txt-3)' }}>visits</div>
                            </div>
                        </div>

                        <div className="section-label">Visit History</div>

                        <div className="patient-list" style={{ maxHeight: '350px' }}>
                            {[...selectedPatient.visits].reverse().map((visit, index) => (
                                <div key={visit.id} className="visit-card">
                                    <div>
                                        <div className="visit-card-date">{formatDate(visit.visitDate)}</div>
                                        <div className="visit-card-next">Next: {formatDate(visit.nextVisitDate)}</div>
                                        <div style={{ marginTop: '0.3rem' }}>
                                            <span style={{ fontSize: '0.68rem', color: visit.completed ? 'var(--emerald)' : 'var(--amber)' }}>
                                                {visit.completed ? '✅ Completed' : '⏳ Pending'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="visit-card-days">{visit.tabletDays}d</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--txt-3)' }}>tablets</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>Treatment Duration</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--teal)' }}>
                                {formatDate(selectedPatient.firstVisitDate)} → {formatDate(selectedPatient.lastNextVisitDate)}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--txt-3)', marginTop: '0.2rem' }}>
                                {Math.ceil((new Date(selectedPatient.lastNextVisitDate) - new Date(selectedPatient.firstVisitDate)) / 86400000)} days total
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PTVisitTracker />);
