// ============================================================
// PT TABLET FOLLOW-UP — Main Application
// Refactored: localStorage only, no Google Sheets dependency
// ============================================================

const { useState, useEffect, useMemo, useCallback } = React;

const STORAGE_KEY = 'ptVisits_v2';

function PTVisitTracker() {
    const [visits, setVisits] = useState([]);
    const [regNumber, setRegNumber] = useState('');
    const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
    const [nextVisitDate, setNextVisitDate] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [showMonthCalendar, setShowMonthCalendar] = useState(false);
    const [showYearView, setShowYearView] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [showMonthView, setShowMonthView] = useState(false);
    const [showLookup, setShowLookup] = useState(false);
    const [lookupSearch, setLookupSearch] = useState('');
    const [showPatientHistory, setShowPatientHistory] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showRegSuggestions, setShowRegSuggestions] = useState(false);
    const [showLookupSuggestions, setShowLookupSuggestions] = useState(false);
    const [toast, setToast] = useState(null);

    // ---- Data Persistence (localStorage) ----
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

    const saveVisits = useCallback((updatedVisits) => {
        setVisits(updatedVisits);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVisits)); }
        catch (e) { console.error('Save error:', e); }
    }, []);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // ---- Memoized Computations ----
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
            if (!v.completed) {
                counts.byMonth[month].add(reg);
                counts.byDate[dateKey].add(reg);
            }
        });
        return {
            byMonth: Object.fromEntries(Object.entries(counts.byMonth).map(([k, v]) => [k, v.size])),
            byDate: Object.fromEntries(Object.entries(counts.byDate).map(([k, v]) => [k, v.size])),
            total: counts.total.size
        };
    }, [visits]);

    const patientTabletData = useMemo(() => {
        const data = {};
        visits.forEach(v => {
            const reg = v.regNumber.trim().toUpperCase();
            if (!data[reg]) {
                data[reg] = {
                    regNumber: v.regNumber,
                    totalTabletDays: 0,
                    visits: [],
                    firstVisitDate: v.visitDate,
                    lastVisitDate: v.visitDate,
                    lastNextVisitDate: v.nextVisitDate
                };
            }
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

    // ---- Helpers ----
    const getPatientTotalTablets = useCallback(
        (reg) => patientTabletData[reg.trim().toUpperCase()]?.totalTabletDays || 0,
        [patientTabletData]
    );

    const calculateTabletDays = (vDate, nDate) => {
        const days = Math.ceil((new Date(nDate) - new Date(vDate)) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    const getUniquePatientsForDate = useCallback(
        (date) => uniquePatientCounts.byDate[new Date(date).toDateString()] || 0,
        [uniquePatientCounts]
    );

    const getUniquePatientsForMonth = useCallback(
        (monthIndex) => uniquePatientCounts.byMonth[monthIndex] || 0,
        [uniquePatientCounts]
    );

    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // ---- Registration Number Formatting (YYYY/AAA/0000) ----
    const formatRegNumber = (value) => {
        let c = value.replace(/[^a-zA-Z0-9]/g, '');
        let f = c.slice(0, 4);
        if (c.length > 4) f += '/' + c.slice(4, 7).toUpperCase();
        if (c.length > 7) f += '/' + c.slice(7, 11);
        return f;
    };

    const handleRegNumberChange = (e) => {
        const formatted = formatRegNumber(e.target.value);
        setRegNumber(formatted);
        setShowRegSuggestions(formatted.length > 0);
    };

    // ---- Autocomplete ----
    const getRegSuggestions = useCallback((term) => {
        if (!term || term.length < 1) return [];
        const s = term.toUpperCase().trim();
        return Object.keys(patientTabletData).filter(r => {
            return r.toUpperCase().includes(s) || r.slice(-4).includes(s);
        }).slice(0, 8);
    }, [patientTabletData]);

    const regNumberSuggestions = useMemo(() => getRegSuggestions(regNumber), [regNumber, getRegSuggestions]);
    const lookupSuggestions = useMemo(() => getRegSuggestions(lookupSearch), [lookupSearch, getRegSuggestions]);

    // ---- Date/Calendar Helpers ----
    const getPatientsForDate = (date) => {
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        return visits.filter(v => {
            const d = new Date(v.nextVisitDate);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === target.getTime();
        });
    };

    const getMonthDatesDetailed = useCallback((monthIndex) => {
        const year = new Date().getFullYear();
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dates = [];

        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, monthIndex, day);
            date.setHours(0, 0, 0, 0);
            const pending = visits.filter(v => {
                const d = new Date(v.nextVisitDate); d.setHours(0, 0, 0, 0);
                return d.getTime() === date.getTime() && !v.completed;
            });
            const uniqueCount = new Set(pending.map(v => v.regNumber.trim().toUpperCase())).size;

            dates.push({
                date, day,
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                count: uniqueCount,
                patients: pending,
                holiday: getHolidayForDate(date),
                isToday: date.getTime() === today.getTime(),
                isSunday: date.getDay() === 0
            });
        }
        return dates;
    }, [visits]);

    const getNext6Visits = () => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() + i + 1);
            return {
                day: d.getDate(),
                month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                count: getUniquePatientsForDate(d),
                fullDate: d
            };
        });
    };

    const getTodayPatients = () => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return visits.filter(v => {
            const d = new Date(v.nextVisitDate); d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
        });
    };

    const getPendingTodayCount = () => {
        const pts = getTodayPatients();
        return new Set(pts.filter(v => !v.completed).map(v => v.regNumber.trim().toUpperCase())).size;
    };

    // ---- CRUD Operations ----
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!regNumber || !visitDate || !nextVisitDate) {
            alert('Please fill in all required fields'); return;
        }
        if (!/^\d{4}\/[A-Z]{3}\/\d{4}$/.test(regNumber)) {
            alert('Invalid format!\n\nRequired: YYYY/AAA/0000\nExample: 2026/ABC/0001'); return;
        }
        if (new Date(nextVisitDate) <= new Date(visitDate)) {
            alert('Next Visit Date must be after Visit Date'); return;
        }

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

    const deleteVisit = (id) => {
        if (confirm('Delete this entry?')) {
            const updated = visits.filter(v => v.id !== id);
            saveVisits(updated);
            showToast('Entry deleted', 'info');
        }
    };

    const clearAllData = () => {
        if (confirm('⚠️ Delete ALL patient data permanently?')) {
            if (confirm('This cannot be undone. Proceed?')) {
                saveVisits([]);
                localStorage.removeItem(STORAGE_KEY);
                showToast('All data cleared', 'info');
            }
        }
    };

    const toggleCompleted = (id) => {
        const updated = visits.map(v =>
            v.id === id ? { ...v, completed: !v.completed, completedAt: !v.completed ? new Date() : null } : v
        );
        saveVisits(updated);
    };

    // ---- Export / Import ----
    const exportData = () => {
        const blob = new Blob([JSON.stringify(visits, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pt-tablet-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup exported successfully');
    };

    const importData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    if (!Array.isArray(imported)) throw new Error('Invalid format');
                    const parsed = imported.map(v => ({
                        ...v,
                        visitDate: new Date(v.visitDate),
                        nextVisitDate: new Date(v.nextVisitDate),
                        recordedAt: new Date(v.recordedAt),
                        completedAt: v.completedAt ? new Date(v.completedAt) : null,
                        tabletDays: v.tabletDays || 0
                    }));
                    saveVisits(parsed);
                    showToast(`Imported ${parsed.length} records`);
                } catch (err) {
                    alert('Invalid backup file. Please use a file exported from this app.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // ---- Navigation Helpers ----
    const openModalForDate = (date) => { setSelectedDate(date); setShowModal(true); setShowMonthCalendar(false); };
    const openMonthView = (monthIndex) => { setSelectedMonth(monthIndex); setShowMonthView(true); };
    const openPatientHistory = (reg) => {
        const p = patientTabletData[reg.trim().toUpperCase()];
        if (p) { setSelectedPatient(p); setShowPatientHistory(true); }
    };

    // ---- Lookup Stats ----
    const lookupStats = useMemo(() => ({
        totalEntries: visits.length,
        uniquePatients: new Set(visits.map(v => v.regNumber.trim().toUpperCase())).size
    }), [visits]);

    // ---- Derived Display Data ----
    const todayPatients = getTodayPatients();
    const pendingToday = getPendingTodayCount();
    const modalPatients = selectedDate ? getPatientsForDate(selectedDate) : [];
    const modalDate = selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
    const currentYear = new Date().getFullYear();

    // ---- Suggestion Dropdown Component ----
    const SuggestionDropdown = ({ suggestions, onSelect, style }) => (
        <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'white', border: '2px solid var(--primary)',
            borderRadius: 'var(--radius-md)', maxHeight: '220px',
            overflowY: 'auto', zIndex: 1000,
            boxShadow: 'var(--shadow-lg)', marginTop: '0.3rem', ...style
        }}>
            {suggestions.map(s => {
                const p = patientTabletData[s.toUpperCase()];
                return (
                    <div key={s} onClick={() => onSelect(p.regNumber)}
                        style={{ padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--divider)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', marginBottom: '0.15rem' }}>{p.regNumber}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                            <span>💊 {p.totalTabletDays}d</span>
                            <span>🔢 {p.visits.length} visits</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="app-container">
            {/* TOAST */}
            {toast && (
                <div className="toast">
                    <span>{toast.type === 'success' ? '✅' : 'ℹ️'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* LOOKUP MODAL */}
            {showLookup && (
                <div className="modal-overlay" onClick={() => setShowLookup(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '800px'}}>
                        <div className="modal-header">
                            <div className="modal-title">🔍 Patient Records</div>
                            <button className="modal-close" onClick={() => setShowLookup(false)}>×</button>
                        </div>

                        <div className="lookup-stats">
                            <div className="lookup-stat">
                                <div className="lookup-stat-value">{lookupStats.uniquePatients}</div>
                                <div className="lookup-stat-label">Unique Patients</div>
                            </div>
                            <div className="lookup-stat">
                                <div className="lookup-stat-value">{lookupStats.totalEntries}</div>
                                <div className="lookup-stat-label">Total Entries</div>
                            </div>
                        </div>

                        <div style={{position: 'relative', marginBottom: '1.25rem'}}>
                            <input type="text" className="form-input" placeholder="Search by reg number or last 4 digits..."
                                value={lookupSearch}
                                onChange={e => { setLookupSearch(e.target.value); setShowLookupSuggestions(true); }}
                                onFocus={() => setShowLookupSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowLookupSuggestions(false), 200)}
                                autoFocus
                            />
                            {showLookupSuggestions && lookupSuggestions.length > 0 && (
                                <SuggestionDropdown suggestions={lookupSuggestions}
                                    onSelect={v => { setLookupSearch(v); setShowLookupSuggestions(false); }} />
                            )}
                        </div>

                        <div className="patient-list" style={{maxHeight: '400px'}}>
                            {(() => {
                                const filtered = Object.values(patientTabletData).filter(p =>
                                    !lookupSearch.trim() || p.regNumber.toUpperCase().includes(lookupSearch.trim().toUpperCase())
                                );
                                if (filtered.length === 0) return (
                                    <div className="empty-state"><div className="empty-state-icon">📋</div><p>No patients found</p></div>
                                );
                                return filtered.sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate)).map(patient => {
                                    const latest = patient.visits[patient.visits.length - 1];
                                    const pending = patient.visits.filter(v => !v.completed).length;
                                    return (
                                        <div key={patient.regNumber} className="patient-item" style={{border: '1.5px solid var(--border)', background: 'white'}}>
                                            <div className="patient-info">
                                                <div className="patient-reg">{patient.regNumber}</div>
                                                <div className="patient-date">
                                                    Latest: {formatDate(latest.visitDate)} → Next: {formatDate(latest.nextVisitDate)}
                                                </div>
                                                <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                                                    <span style={{background: 'var(--primary-100)', color: 'var(--primary)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 700}}>
                                                        💊 {patient.totalTabletDays}d
                                                    </span>
                                                    <span style={{background: '#F3E8FF', color: '#7C3AED', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 700}}>
                                                        🔢 {patient.visits.length} visits
                                                    </span>
                                                    <span style={{background: pending > 0 ? 'var(--warning-light)' : 'var(--success-light)', color: pending > 0 ? '#D97706' : '#059669', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 700}}>
                                                        {pending > 0 ? `⏳ ${pending} pending` : '✓ Done'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="patient-actions" style={{flexDirection: 'column', gap: '0.4rem'}}>
                                                <button className="btn btn-primary btn-small" onClick={() => openPatientHistory(patient.regNumber)}>History</button>
                                                <button className="btn btn-danger btn-small" onClick={() => {
                                                    if (confirm(`Delete all ${patient.visits.length} visits for ${patient.regNumber}?`))
                                                        patient.visits.forEach(v => deleteVisit(v.id));
                                                }}>Delete</button>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        <div style={{display: 'flex', gap: '0.5rem', marginTop: '1.25rem'}}>
                            <button className="btn btn-export btn-small" onClick={exportData} style={{flex: 1}}>
                                📤 Export Backup
                            </button>
                            <button className="btn btn-secondary btn-small" onClick={importData} style={{flex: 1}}>
                                📥 Import Backup
                            </button>
                            {visits.length > 0 && (
                                <button className="btn btn-danger btn-small" onClick={clearAllData} style={{flex: 1}}>
                                    🗑 Clear All
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <header className="header">
                <h1>🫁 PT Tablet Follow-up</h1>
                <p>Track tablet distribution & manage follow-up schedules</p>
                {!hasHolidayData(currentYear) && (
                    <div style={{
                        marginTop: '0.75rem', padding: '0.5rem 0.75rem',
                        background: 'rgba(245, 158, 11, 0.2)', borderRadius: '8px',
                        fontSize: '0.78rem', color: '#FDE68A'
                    }}>
                        ⚠️ Holiday data not available for {currentYear}. Update data.js with official calendar.
                    </div>
                )}
                <div style={{
                    position: 'absolute', bottom: '1rem', right: '1rem',
                    background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
                    border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: '10px',
                    padding: '0.5rem 0.85rem', textAlign: 'center', minWidth: '85px'
                }}>
                    <div style={{fontSize: '0.6rem', color: 'white', opacity: 0.8, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700}}>
                        Total Patients
                    </div>
                    <div style={{fontSize: '1.65rem', fontWeight: 800, color: 'white', lineHeight: 1, fontFamily: 'var(--font-display)'}}>
                        {uniquePatientCounts.total}
                    </div>
                </div>
            </header>

            {/* STATS ROW */}
            <div className="stats-grid">
                <div className="stat-card" style={{
                    background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)',
                    color: 'white', border: 'none',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                }}>
                    <div className="stat-date" style={{fontSize: '0.7rem', marginBottom: '0.4rem', marginTop: 0, color: 'white', opacity: 0.85}}>Unique Patients Today</div>
                    <div className="stat-value" style={{fontSize: '3.2rem', color: 'white'}}>{pendingToday}</div>
                    <div className="stat-label" style={{fontSize: '0.8rem', color: 'white', opacity: 0.85}}>Pending Follow-ups</div>
                </div>
                <div className="stat-card clickable" onClick={() => openModalForDate(new Date())} style={{cursor: 'pointer'}}>
                    <div className="stat-date" style={{fontSize: '0.7rem', marginBottom: '0.4rem', marginTop: 0}}>
                        {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                    <div className="stat-value" style={{fontSize: '3.2rem'}}>{new Date().getDate()}</div>
                    <div className="stat-label" style={{fontSize: '0.8rem'}}>Today — {pendingToday} Patients</div>
                </div>
            </div>

            {/* NEXT 6 DAYS + QUICK NAV */}
            <div className="stats-grid-2">
                {getNext6Visits().map((v, i) => (
                    <div key={i} className="stat-card clickable" onClick={() => openModalForDate(v.fullDate)} style={{cursor: 'pointer'}}>
                        <div className="stat-date" style={{fontSize: '0.65rem', marginBottom: '0.35rem', marginTop: 0}}>{v.month}</div>
                        <div className="stat-value" style={{fontSize: '2.2rem'}}>{v.day}</div>
                        <div className="stat-label" style={{fontSize: '0.65rem'}}>Day {i + 1}<br/>{v.count} PT</div>
                    </div>
                ))}
                <div className="stat-card clickable" onClick={() => setShowMonthCalendar(true)}
                    style={{cursor: 'pointer', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', border: 'none'}}>
                    <div className="stat-date" style={{fontSize: '0.65rem', marginBottom: '0.35rem', marginTop: 0, color: 'white', opacity: 0.85}}>
                        {currentYear}
                    </div>
                    <div className="stat-value" style={{fontSize: '1.3rem', color: 'white'}}>
                        {new Date().toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                    <div className="stat-label" style={{fontSize: '0.65rem', color: 'white', opacity: 0.85}}>Month</div>
                </div>
                <div className="stat-card clickable" onClick={() => setShowYearView(true)}
                    style={{cursor: 'pointer', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)', color: 'white', border: 'none'}}>
                    <div className="stat-date" style={{fontSize: '0.65rem', marginBottom: '0.35rem', marginTop: 0, color: 'white', opacity: 0.85}}>Full Year</div>
                    <div className="stat-value" style={{fontSize: '1.8rem', color: 'white'}}>{currentYear}</div>
                    <div className="stat-label" style={{fontSize: '0.65rem', color: 'white', opacity: 0.85}}>Overview</div>
                </div>
            </div>

            {/* MAIN CONTENT: FORM + CALENDAR */}
            <div className="main-content">
                {/* LEFT: Form + Recent */}
                <div className="card">
                    <h2 className="card-title">Assign Tablets</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{position: 'relative'}}>
                            <label className="form-label">PT Registration Number *</label>
                            <input type="text" className="form-input" value={regNumber}
                                onChange={handleRegNumberChange}
                                onFocus={() => setShowRegSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowRegSuggestions(false), 200)}
                                placeholder="2026/ABC/0001" maxLength={14} required autoFocus
                                style={{fontFamily: 'var(--font-mono)', fontSize: '1.05rem', letterSpacing: '0.5px'}}
                            />
                            {showRegSuggestions && regNumberSuggestions.length > 0 && (
                                <SuggestionDropdown suggestions={regNumberSuggestions}
                                    onSelect={v => { setRegNumber(v); setShowRegSuggestions(false); }}
                                    style={{maxHeight: '180px'}} />
                            )}
                            {regNumber && patientTabletData[regNumber.trim().toUpperCase()] && (
                                <div style={{
                                    marginTop: '0.5rem', padding: '0.5rem 0.7rem',
                                    background: 'var(--primary-100)', borderRadius: '8px',
                                    fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600
                                }}>
                                    Existing Patient — Total so far: <strong>{getPatientTotalTablets(regNumber)} days</strong>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Visit Date *</label>
                            <input type="date" className="form-input" value={visitDate} onChange={e => setVisitDate(e.target.value)} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Next Visit Date *</label>
                            <input type="date" className="form-input" value={nextVisitDate} onChange={e => setNextVisitDate(e.target.value)} required />
                        </div>

                        {visitDate && nextVisitDate && (
                            <div style={{
                                marginBottom: '1.25rem', padding: '1rem',
                                background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)',
                                borderRadius: 'var(--radius-md)', color: 'white'
                            }}>
                                <div style={{fontSize: '0.72rem', opacity: 0.9, marginBottom: '0.2rem'}}>Tablets to be given:</div>
                                <div style={{fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)'}}>{calculateTabletDays(visitDate, nextVisitDate)} days</div>
                                {regNumber && (
                                    <div style={{fontSize: '0.72rem', opacity: 0.9, marginTop: '0.35rem'}}>
                                        New total: {getPatientTotalTablets(regNumber) + calculateTabletDays(visitDate, nextVisitDate)} days
                                    </div>
                                )}
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary" style={{width: '100%', marginBottom: '0.75rem'}}>
                            Add Next Visit
                        </button>
                        <button type="button" className="btn btn-lookup" onClick={() => setShowLookup(true)} style={{width: '100%'}}>
                            🔍 Look Up Patient Records
                        </button>
                    </form>

                    {/* Recent Entries */}
                    {visits.length > 0 && (
                        <>
                            <h3 className="card-title" style={{marginTop: '1.75rem'}}>Recent Entries</h3>
                            <div style={{
                                background: 'var(--primary-50)', padding: '0.6rem 0.75rem',
                                borderRadius: '8px', marginBottom: '0.75rem',
                                fontSize: '0.78rem', color: 'var(--text-secondary)'
                            }}>
                                Latest visit per patient. Use <strong>Look Up</strong> for full history.
                            </div>
                            <div className="patient-list">
                                {Object.values(patientTabletData)
                                    .sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate))
                                    .slice(0, 12)
                                    .map(patient => {
                                        const latest = patient.visits[patient.visits.length - 1];
                                        return (
                                            <div key={patient.regNumber} className={`patient-item ${latest.completed ? 'completed' : ''}`}>
                                                <div className="patient-info">
                                                    <div className="patient-reg">{patient.regNumber}</div>
                                                    <div className="patient-date">
                                                        {formatDate(latest.visitDate)} → {formatDate(latest.nextVisitDate)}
                                                    </div>
                                                    <div style={{display: 'flex', gap: '0.6rem', marginTop: '0.4rem', fontSize: '0.75rem'}}>
                                                        <span style={{color: 'var(--success)', fontWeight: 700}}>📊 {latest.tabletDays}d</span>
                                                        <span style={{color: 'var(--primary)', fontWeight: 700}}>💊 Total: {patient.totalTabletDays}d</span>
                                                        <span style={{color: 'var(--text-tertiary)'}}>🔢 {patient.visits.length}</span>
                                                    </div>
                                                </div>
                                                <button className="btn btn-secondary btn-small" onClick={() => openPatientHistory(patient.regNumber)}>
                                                    History
                                                </button>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </>
                    )}
                </div>

                {/* RIGHT: Calendar Year Grid */}
                <div className="card" style={{marginBottom: '2rem'}}>
                    <h2 className="card-title">Calendar View</h2>
                    <div className="calendar-year-grid">
                        {MONTHS.map((month, index) => {
                            const count = getUniquePatientsForMonth(index);
                            return (
                                <div key={month} className="calendar-month-card" onClick={() => openMonthView(index)}>
                                    <div style={{
                                        fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)',
                                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem',
                                        fontFamily: 'var(--font-display)'
                                    }}>
                                        {month.slice(0, 3)}
                                    </div>
                                    <div style={{
                                        fontSize: '1.8rem', fontWeight: 800,
                                        color: count > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                        lineHeight: 1, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em'
                                    }}>
                                        {count}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MONTH VIEW MODAL */}
            {showMonthView && selectedMonth !== null && (
                <div className="modal-overlay" onClick={() => setShowMonthView(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '1200px'}}>
                        <div className="modal-header">
                            <div className="modal-title">{MONTHS[selectedMonth]} {currentYear}</div>
                            <button className="modal-close" onClick={() => setShowMonthView(false)}>×</button>
                        </div>
                        <div className="month-view-calendar">
                            {getMonthDatesDetailed(selectedMonth).map(d => {
                                let cls = 'month-view-date';
                                if (d.isToday) cls += ' today';
                                if (d.isSunday) cls += ' sunday';
                                if (d.holiday) cls += d.holiday.type === 'poya' ? ' poya' : ' holiday';
                                return (
                                    <div key={d.day} className={cls}
                                        onClick={() => d.count > 0 && openModalForDate(d.date)}>
                                        <div className="month-view-day-name">{d.dayName}</div>
                                        <div className="month-view-day-number">{d.day}</div>
                                        {d.count > 0 && <div className="month-view-pt-count">{d.count} PT</div>}
                                        {d.holiday && <div className="month-view-holiday-name">{d.holiday.name}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* YEAR VIEW MODAL */}
            {showYearView && (
                <div className="modal-overlay" onClick={() => setShowYearView(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '1100px'}}>
                        <div className="modal-header">
                            <div className="modal-title">Full Year — {currentYear}</div>
                            <button className="modal-close" onClick={() => setShowYearView(false)}>×</button>
                        </div>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem'}}>
                            {MONTHS.map((month, index) => {
                                const count = getUniquePatientsForMonth(index);
                                return (
                                    <div key={month} style={{
                                        background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                                        borderRadius: 'var(--radius-md)', padding: '1.15rem', textAlign: 'center'
                                    }}>
                                        <div style={{fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-display)'}}>{month.slice(0, 3)}</div>
                                        <div style={{fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)'}}>{count}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{marginTop: '1.5rem', padding: '1.15rem', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border)'}}>
                            <div style={{fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem'}}>Total Unique Patients</div>
                            <div style={{fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em'}}>{uniquePatientCounts.total}</div>
                            <div style={{fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.3rem'}}>({visits.length} total entries)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* CURRENT MONTH CALENDAR MODAL */}
            {showMonthCalendar && (
                <div className="modal-overlay" onClick={() => setShowMonthCalendar(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '900px'}}>
                        <div className="modal-header">
                            <div className="modal-title">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                            <button className="modal-close" onClick={() => setShowMonthCalendar(false)}>×</button>
                        </div>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem'}}>
                            {Array.from({length: new Date(currentYear, new Date().getMonth() + 1, 0).getDate()}, (_, i) => {
                                const date = new Date(currentYear, new Date().getMonth(), i + 1);
                                const count = getUniquePatientsForDate(date);
                                const isToday = date.toDateString() === new Date().toDateString();
                                return (
                                    <div key={i} onClick={() => openModalForDate(date)} style={{
                                        background: isToday ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' : 'var(--bg-input)',
                                        border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                        padding: '0.85rem 0.5rem', textAlign: 'center', cursor: 'pointer',
                                        transition: 'all 0.2s', color: isToday ? 'white' : 'inherit'
                                    }}>
                                        <div style={{fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.2rem', fontFamily: 'var(--font-display)'}}>{i + 1}</div>
                                        <div style={{fontSize: '0.7rem', color: isToday ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)', fontWeight: 600}}>{count} PT</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* DATE PATIENTS MODAL */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">📋 {modalDate}</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        {modalPatients.length === 0 ? (
                            <div className="empty-state"><div className="empty-state-icon">📋</div><p>No patients scheduled for this date</p></div>
                        ) : (
                            <>
                                <div style={{
                                    background: 'var(--primary-50)', padding: '0.65rem 0.85rem',
                                    borderRadius: '8px', marginBottom: '1rem', fontSize: '0.82rem',
                                    color: 'var(--text-secondary)', border: '1px solid var(--border)'
                                }}>
                                    <strong style={{color: 'var(--primary)'}}>
                                        {new Set(modalPatients.filter(v => !v.completed).map(v => v.regNumber.trim().toUpperCase())).size}
                                    </strong> unique patients pending
                                </div>
                                <div className="patient-list">
                                    {modalPatients.map(visit => (
                                        <div key={visit.id} className={`patient-item ${visit.completed ? 'completed' : ''}`}>
                                            <div className="patient-info">
                                                <div className="patient-reg">{visit.regNumber}</div>
                                                <div className="patient-date">{visit.completed ? 'Completed ✓' : 'Pending'}</div>
                                            </div>
                                            <div className="patient-actions">
                                                <input type="checkbox" className="checkbox" checked={visit.completed} onChange={() => toggleCompleted(visit.id)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* PATIENT HISTORY MODAL */}
            {showPatientHistory && selectedPatient && (
                <div className="modal-overlay" onClick={() => setShowPatientHistory(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '700px'}}>
                        <div className="modal-header">
                            <div className="modal-title">📊 Tablet History</div>
                            <button className="modal-close" onClick={() => setShowPatientHistory(false)}>×</button>
                        </div>

                        <div style={{
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                            color: 'white', padding: '1.5rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem'
                        }}>
                            <div style={{fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'var(--font-display)'}}>
                                {selectedPatient.regNumber}
                            </div>
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '0.75rem'}}>
                                <div>
                                    <div style={{fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.15rem'}}>Total Tablets</div>
                                    <div style={{fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)'}}>{selectedPatient.totalTabletDays}</div>
                                    <div style={{fontSize: '0.7rem', opacity: 0.8}}>days</div>
                                </div>
                                <div>
                                    <div style={{fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.15rem'}}>Total Visits</div>
                                    <div style={{fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)'}}>{selectedPatient.visits.length}</div>
                                    <div style={{fontSize: '0.7rem', opacity: 0.8}}>visits</div>
                                </div>
                            </div>
                        </div>

                        <h3 style={{marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 700}}>Visit History</h3>
                        <div className="patient-list" style={{maxHeight: '350px'}}>
                            {selectedPatient.visits.map((visit, index) => (
                                <div key={visit.id} style={{
                                    background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-sm)',
                                    marginBottom: '0.6rem', border: '1.5px solid var(--border)', borderLeft: '4px solid var(--success)'
                                }}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem'}}>
                                        <div>
                                            <div style={{fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '0.1rem'}}>Visit #{selectedPatient.visits.length - index}</div>
                                            <div style={{fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)'}}>{formatDate(visit.visitDate)}</div>
                                        </div>
                                        <div style={{
                                            background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)',
                                            color: 'white', padding: '0.35rem 0.75rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.95rem'
                                        }}>
                                            {visit.tabletDays}d
                                        </div>
                                    </div>
                                    <div style={{fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem'}}>
                                        <div>Next: {formatDate(visit.nextVisitDate)}</div>
                                        <div>{visit.completed ? '✅ Completed' : '⏳ Pending'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{
                            marginTop: '1.25rem', padding: '1rem', background: 'var(--success-light)',
                            borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)'
                        }}>
                            <div style={{fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.2rem'}}>Treatment Duration</div>
                            <div style={{fontSize: '1.05rem', fontWeight: 800, color: 'var(--success)'}}>
                                {formatDate(selectedPatient.firstVisitDate)} → {formatDate(selectedPatient.lastNextVisitDate)}
                            </div>
                            <div style={{fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem'}}>
                                ({Math.ceil((new Date(selectedPatient.lastNextVisitDate) - new Date(selectedPatient.firstVisitDate)) / (1000 * 60 * 60 * 24))} days)
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PTVisitTracker />);
