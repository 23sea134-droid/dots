// ============================================================
// PT TABLET FOLLOW-UP — Main Application
// Google Drive Sync Edition
// ============================================================

const { useState, useEffect, useMemo, useCallback, useRef } = React;

const STORAGE_KEY = 'ptVisits_v2';
const DRIVE_FILE_NAME = 'pt-tablet-data.json';

// ============================================================
// 🔑 REPLACE THESE WITH YOUR ACTUAL GOOGLE CLOUD CREDENTIALS
// ============================================================
const GOOGLE_CLIENT_ID = '1084630957918-7r7abaqhh62i4sqesoqhtvfu6en67si7.apps.googleusercontent.com';
const GOOGLE_API_KEY   = 'AIzaSyAiZPst6m_6j6J3A4_oVJqNZnfO1RV36qo';
// ============================================================

const SCOPES = 'https://www.googleapis.com/auth/drive.file';

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

    // ---- Google Drive State ----
    const [gapiReady, setGapiReady] = useState(false);
    const [gisReady, setGisReady] = useState(false);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [driveFileId, setDriveFileId] = useState(null);
    const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | saved | error
    const [syncError, setSyncError] = useState(null);
    const [showSyncSetup, setShowSyncSetup] = useState(false);
    const [sharedFileId, setSharedFileId] = useState('');
    const tokenClientRef = useRef(null);
    const syncTimeoutRef = useRef(null);

    // ---- Load Google APIs ----
    useEffect(() => {
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = () => {
            window.gapi.load('client', async () => {
                await window.gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                });
                setGapiReady(true);
            });
        };
        document.head.appendChild(gapiScript);

        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.onload = () => {
            tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPES,
                callback: (response) => {
                    if (response.error) { setSyncError('Sign-in failed: ' + response.error); return; }
                    setIsSignedIn(true);
                    loadUserProfile();
                    loadOrCreateDriveFile();
                },
            });
            setGisReady(true);
        };
        document.head.appendChild(gisScript);

        const savedFileId = localStorage.getItem('ptDriveFileId');
        if (savedFileId) setDriveFileId(savedFileId);
    }, []);

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

    // ---- Google Sign In / Out ----
    const handleSignIn = () => {
        if (!gapiReady || !gisReady) { showToast('Google API still loading...', 'info'); return; }
        if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
            showToast('⚠️ Add your Google Client ID to app.js first!', 'error'); return;
        }
        tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    };

    const handleSignOut = () => {
        const token = window.gapi.client.getToken();
        if (token) { window.google.accounts.oauth2.revoke(token.access_token); window.gapi.client.setToken(''); }
        setIsSignedIn(false); setUserProfile(null); setSyncStatus('idle');
        showToast('Signed out from Google', 'info');
    };

    const loadUserProfile = async () => {
        try {
            const res = await window.gapi.client.request({ path: 'https://www.googleapis.com/oauth2/v3/userinfo' });
            setUserProfile(res.result);
        } catch (e) { console.error('Profile error:', e); }
    };

    // ---- Drive File Management ----
    const loadOrCreateDriveFile = async () => {
        setSyncStatus('syncing');
        try {
            const res = await window.gapi.client.drive.files.list({
                q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
                spaces: 'drive',
                fields: 'files(id, name)',
            });
            if (res.result.files.length > 0) {
                const fileId = res.result.files[0].id;
                setDriveFileId(fileId);
                localStorage.setItem('ptDriveFileId', fileId);
                await downloadFromDrive(fileId);
            } else {
                await createDriveFile();
            }
        } catch (e) { setSyncStatus('error'); setSyncError('Could not access Google Drive'); console.error(e); }
    };

    const createDriveFile = async () => {
        try {
            const boundary = '-------314159265358979323846';
            const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
            const currentData = localStorage.getItem(STORAGE_KEY) || '[]';
            const body =
                `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n` +
                `--${boundary}\r\nContent-Type: application/json\r\n\r\n${currentData}\r\n` +
                `--${boundary}--`;
            const res = await window.gapi.client.request({
                path: 'https://www.googleapis.com/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
                body,
            });
            const fileId = res.result.id;
            setDriveFileId(fileId);
            localStorage.setItem('ptDriveFileId', fileId);
            setSyncStatus('saved');
            showToast('✓ Google Drive connected! File created.');
        } catch (e) { setSyncStatus('error'); console.error('Create file error:', e); }
    };

    const downloadFromDrive = async (fileId) => {
        try {
            const res = await window.gapi.client.drive.files.get({ fileId, alt: 'media' });
            const data = typeof res.result === 'string' ? JSON.parse(res.result) : res.result;
            if (Array.isArray(data)) {
                const parsed = data.map(v => ({
                    ...v,
                    visitDate: new Date(v.visitDate), nextVisitDate: new Date(v.nextVisitDate),
                    recordedAt: new Date(v.recordedAt),
                    completedAt: v.completedAt ? new Date(v.completedAt) : null,
                    tabletDays: v.tabletDays || 0
                }));
                setVisits(parsed);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                setSyncStatus('saved');
                showToast(`✓ Synced from Google Drive (${parsed.length} records)`);
            }
        } catch (e) { setSyncStatus('error'); console.error('Download error:', e); }
    };

    const uploadToDrive = useCallback(async (data, fileId) => {
        if (!fileId || !isSignedIn) return;
        setSyncStatus('syncing');
        try {
            await window.gapi.client.request({
                path: `https://www.googleapis.com/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            setSyncStatus('saved');
        } catch (e) { setSyncStatus('error'); setSyncError('Sync failed. Changes saved locally.'); console.error('Upload error:', e); }
    }, [isSignedIn]);

    // ---- Connect to a Shared File ----
    const connectSharedFile = async () => {
        if (!sharedFileId.trim()) return;
        setSyncStatus('syncing');
        try {
            await downloadFromDrive(sharedFileId.trim());
            setDriveFileId(sharedFileId.trim());
            localStorage.setItem('ptDriveFileId', sharedFileId.trim());
            setShowSyncSetup(false);
            showToast('✓ Connected to shared file!');
        } catch (e) { setSyncStatus('error'); showToast('Could not connect to that File ID', 'error'); }
    };

    // ---- Save (local + drive debounced) ----
    const saveVisits = useCallback((updatedVisits) => {
        setVisits(updatedVisits);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedVisits));
        if (isSignedIn && driveFileId) {
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = setTimeout(() => uploadToDrive(updatedVisits, driveFileId), 1500);
        }
    }, [isSignedIn, driveFileId, uploadToDrive]);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // ---- Memoized Computations ----
    const uniquePatientCounts = useMemo(() => {
        const counts = { byMonth: {}, byDate: {}, total: new Set() };
        visits.forEach(v => {
            const d = new Date(v.nextVisitDate);
            const month = d.getMonth(); const dateKey = d.toDateString();
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

    const patientTabletData = useMemo(() => {
        const data = {};
        visits.forEach(v => {
            const reg = v.regNumber.trim().toUpperCase();
            if (!data[reg]) data[reg] = { regNumber: v.regNumber, totalTabletDays: 0, visits: [], firstVisitDate: v.visitDate, lastVisitDate: v.visitDate, lastNextVisitDate: v.nextVisitDate };
            const p = data[reg];
            p.totalTabletDays += v.tabletDays; p.visits.push(v);
            if (new Date(v.visitDate) < new Date(p.firstVisitDate)) p.firstVisitDate = v.visitDate;
            if (new Date(v.visitDate) > new Date(p.lastVisitDate)) p.lastVisitDate = v.visitDate;
            if (new Date(v.nextVisitDate) > new Date(p.lastNextVisitDate)) p.lastNextVisitDate = v.nextVisitDate;
        });
        Object.values(data).forEach(p => p.visits.sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate)));
        return data;
    }, [visits]);

    const getPatientTotalTablets = useCallback((reg) => patientTabletData[reg.trim().toUpperCase()]?.totalTabletDays || 0, [patientTabletData]);
    const calculateTabletDays = (vDate, nDate) => { const d = Math.ceil((new Date(nDate) - new Date(vDate)) / 86400000); return d > 0 ? d : 0; };
    const getUniquePatientsForDate = useCallback((date) => uniquePatientCounts.byDate[new Date(date).toDateString()] || 0, [uniquePatientCounts]);
    const getUniquePatientsForMonth = useCallback((m) => uniquePatientCounts.byMonth[m] || 0, [uniquePatientCounts]);
    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const formatRegNumber = (value) => {
        let c = value.replace(/[^a-zA-Z0-9]/g, '');
        let f = c.slice(0, 4);
        if (c.length > 4) f += '/' + c.slice(4, 7).toUpperCase();
        if (c.length > 7) f += '/' + c.slice(7, 11);
        return f;
    };

    const handleRegNumberChange = (e) => { const f = formatRegNumber(e.target.value); setRegNumber(f); setShowRegSuggestions(f.length > 0); };

    const getRegSuggestions = useCallback((term) => {
        if (!term) return [];
        const s = term.toUpperCase().trim();
        return Object.keys(patientTabletData).filter(r => r.toUpperCase().includes(s) || r.slice(-4).includes(s)).slice(0, 8);
    }, [patientTabletData]);

    const regNumberSuggestions = useMemo(() => getRegSuggestions(regNumber), [regNumber, getRegSuggestions]);
    const lookupSuggestions = useMemo(() => getRegSuggestions(lookupSearch), [lookupSearch, getRegSuggestions]);

    const getPatientsForDate = (date) => {
        const target = new Date(date); target.setHours(0, 0, 0, 0);
        return visits.filter(v => { const d = new Date(v.nextVisitDate); d.setHours(0, 0, 0, 0); return d.getTime() === target.getTime(); });
    };

    const getMonthDatesDetailed = useCallback((monthIndex) => {
        const year = new Date().getFullYear();
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dates = [];
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, monthIndex, day); date.setHours(0, 0, 0, 0);
            const pending = visits.filter(v => { const d = new Date(v.nextVisitDate); d.setHours(0, 0, 0, 0); return d.getTime() === date.getTime() && !v.completed; });
            dates.push({ date, day, dayName: date.toLocaleDateString('en-US', { weekday: 'short' }), count: new Set(pending.map(v => v.regNumber.trim().toUpperCase())).size, patients: pending, holiday: getHolidayForDate(date), isToday: date.getTime() === today.getTime(), isSunday: date.getDay() === 0 });
        }
        return dates;
    }, [visits]);

    const getNext6Visits = () => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return Array.from({ length: 6 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i + 1); return { day: d.getDate(), month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), count: getUniquePatientsForDate(d), fullDate: d }; });
    };

    const getTodayPatients = () => { const today = new Date(); today.setHours(0, 0, 0, 0); return visits.filter(v => { const d = new Date(v.nextVisitDate); d.setHours(0, 0, 0, 0); return d.getTime() === today.getTime(); }); };
    const getPendingTodayCount = () => new Set(getTodayPatients().filter(v => !v.completed).map(v => v.regNumber.trim().toUpperCase())).size;

    // ---- CRUD ----
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!regNumber || !visitDate || !nextVisitDate) { alert('Please fill in all required fields'); return; }
        if (!/^\d{4}\/[A-Z]{3}\/\d{4}$/.test(regNumber)) { alert('Invalid format!\n\nRequired: YYYY/AAA/0000\nExample: 2026/ABC/0001'); return; }
        if (new Date(nextVisitDate) <= new Date(visitDate)) { alert('Next Visit Date must be after Visit Date'); return; }
        const tabletDays = calculateTabletDays(visitDate, nextVisitDate);
        const currentTotal = getPatientTotalTablets(regNumber);
        saveVisits([{ id: Date.now(), regNumber: regNumber.trim(), visitDate: new Date(visitDate), nextVisitDate: new Date(nextVisitDate), tabletDays, completed: false, recordedAt: new Date() }, ...visits]);
        showToast(`✓ Recorded — ${tabletDays} days (Total: ${currentTotal + tabletDays})`);
        setRegNumber(''); setVisitDate(new Date().toISOString().split('T')[0]); setNextVisitDate('');
    };

    const deleteVisit = (id) => { if (confirm('Delete this entry?')) { saveVisits(visits.filter(v => v.id !== id)); showToast('Entry deleted', 'info'); } };
    const clearAllData = () => { if (confirm('⚠️ Delete ALL patient data permanently?')) { if (confirm('This cannot be undone. Proceed?')) { saveVisits([]); localStorage.removeItem(STORAGE_KEY); showToast('All data cleared', 'info'); } } };
    const toggleCompleted = (id) => saveVisits(visits.map(v => v.id === id ? { ...v, completed: !v.completed, completedAt: !v.completed ? new Date() : null } : v));

    const exportData = () => {
        const blob = new Blob([JSON.stringify(visits, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
        a.download = `pt-tablet-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
        showToast('Backup exported successfully');
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

    const openModalForDate = (date) => { setSelectedDate(date); setShowModal(true); setShowMonthCalendar(false); };
    const openMonthView = (m) => { setSelectedMonth(m); setShowMonthView(true); };
    const openPatientHistory = (reg) => { const p = patientTabletData[reg.trim().toUpperCase()]; if (p) { setSelectedPatient(p); setShowPatientHistory(true); } };

    const lookupStats = useMemo(() => ({ totalEntries: visits.length, uniquePatients: new Set(visits.map(v => v.regNumber.trim().toUpperCase())).size }), [visits]);

    const pendingToday = getPendingTodayCount();
    const modalPatients = selectedDate ? getPatientsForDate(selectedDate) : [];
    const modalDate = selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
    const currentYear = new Date().getFullYear();

    // ---- Sync Badge ----
    const SyncBadge = () => {
        const map = { idle: ['☁️', 'Not synced', '#94A3B8'], syncing: ['🔄', 'Syncing...', '#F59E0B'], saved: ['✅', 'Saved to Drive', '#10B981'], error: ['⚠️', 'Sync error', '#EF4444'] };
        const [icon, label, color] = map[syncStatus];
        return <span style={{ fontSize: '0.72rem', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none', display: 'inline-block' }}>{icon}</span>{label}</span>;
    };

    const SuggestionDropdown = ({ suggestions, onSelect, style }) => (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '2px solid var(--primary)', borderRadius: 'var(--radius-md)', maxHeight: '220px', overflowY: 'auto', zIndex: 1000, boxShadow: 'var(--shadow-lg)', marginTop: '0.3rem', ...style }}>
            {suggestions.map(s => { const p = patientTabletData[s.toUpperCase()]; return (
                <div key={s} onClick={() => onSelect(p.regNumber)} style={{ padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--divider)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', marginBottom: '0.15rem' }}>{p.regNumber}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}><span>💊 {p.totalTabletDays}d</span><span>🔢 {p.visits.length} visits</span></div>
                </div>
            ); })}
        </div>
    );

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="app-container">
            {toast && <div className="toast"><span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span><span>{toast.message}</span></div>}

            {/* SYNC SETUP MODAL */}
            {showSyncSetup && (
                <div className="modal-overlay" onClick={() => setShowSyncSetup(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
                        <div className="modal-header">
                            <div className="modal-title">☁️ Team Sync Setup</div>
                            <button className="modal-close" onClick={() => setShowSyncSetup(false)}>×</button>
                        </div>

                        {driveFileId && (
                            <div style={{ background: 'var(--success-light)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✅ Your Drive File ID — share this with teammates</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', background: 'white', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', wordBreak: 'break-all' }}>{driveFileId}</div>
                                <button className="btn btn-primary btn-small" style={{ marginTop: '0.6rem', width: '100%' }} onClick={() => { navigator.clipboard.writeText(driveFileId); showToast('File ID copied!'); }}>📋 Copy File ID</button>
                            </div>
                        )}

                        <div style={{ background: 'var(--primary-50)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Connect to a Teammate's File</div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Paste the Drive File ID shared by your admin to access the same data.</p>
                            <input type="text" className="form-input" placeholder="Paste Drive File ID here..." value={sharedFileId} onChange={e => setSharedFileId(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginBottom: '0.6rem' }} />
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={connectSharedFile}>🔗 Connect to Shared File</button>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.7, background: 'var(--bg-input)', padding: '0.85rem', borderRadius: '8px' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>How team sync works:</strong><br />
                            1. First person signs in → file is created on their Google Drive<br />
                            2. They copy the File ID above and share it with teammates<br />
                            3. Teammates paste it here to connect to the same file<br />
                            4. All changes sync automatically to everyone ✓
                        </div>
                    </div>
                </div>
            )}

            {/* LOOKUP MODAL */}
            {showLookup && (
                <div className="modal-overlay" onClick={() => setShowLookup(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                        <div className="modal-header"><div className="modal-title">🔍 Patient Records</div><button className="modal-close" onClick={() => setShowLookup(false)}>×</button></div>
                        <div className="lookup-stats">
                            <div className="lookup-stat"><div className="lookup-stat-value">{lookupStats.uniquePatients}</div><div className="lookup-stat-label">Unique Patients</div></div>
                            <div className="lookup-stat"><div className="lookup-stat-value">{lookupStats.totalEntries}</div><div className="lookup-stat-label">Total Entries</div></div>
                        </div>
                        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                            <input type="text" className="form-input" placeholder="Search by reg number or last 4 digits..." value={lookupSearch} onChange={e => { setLookupSearch(e.target.value); setShowLookupSuggestions(true); }} onFocus={() => setShowLookupSuggestions(true)} onBlur={() => setTimeout(() => setShowLookupSuggestions(false), 200)} autoFocus />
                            {showLookupSuggestions && lookupSuggestions.length > 0 && <SuggestionDropdown suggestions={lookupSuggestions} onSelect={v => { setLookupSearch(v); setShowLookupSuggestions(false); }} />}
                        </div>
                        <div className="patient-list" style={{ maxHeight: '400px' }}>
                            {(() => {
                                const filtered = Object.values(patientTabletData).filter(p => !lookupSearch.trim() || p.regNumber.toUpperCase().includes(lookupSearch.trim().toUpperCase()));
                                if (filtered.length === 0) return <div className="empty-state"><div className="empty-state-icon">📋</div><p>No patients found</p></div>;
                                return filtered.sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate)).map(patient => {
                                    const latest = patient.visits[patient.visits.length - 1];
                                    const pending = patient.visits.filter(v => !v.completed).length;
                                    return (
                                        <div key={patient.regNumber} className="patient-item" style={{ border: '1.5px solid var(--border)', background: 'white' }}>
                                            <div className="patient-info">
                                                <div className="patient-reg">{patient.regNumber}</div>
                                                <div className="patient-date">Latest: {formatDate(latest.visitDate)} → Next: {formatDate(latest.nextVisitDate)}</div>
                                                <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                                                    <span style={{ background: 'var(--primary-100)', color: 'var(--primary)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>💊 {patient.totalTabletDays}d</span>
                                                    <span style={{ background: '#F3E8FF', color: '#7C3AED', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>🔢 {patient.visits.length} visits</span>
                                                    <span style={{ background: pending > 0 ? 'var(--warning-light)' : 'var(--success-light)', color: pending > 0 ? '#D97706' : '#059669', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>{pending > 0 ? `⏳ ${pending} pending` : '✓ Done'}</span>
                                                </div>
                                            </div>
                                            <div className="patient-actions" style={{ flexDirection: 'column', gap: '0.4rem' }}>
                                                <button className="btn btn-primary btn-small" onClick={() => openPatientHistory(patient.regNumber)}>History</button>
                                                <button className="btn btn-danger btn-small" onClick={() => { if (confirm(`Delete all ${patient.visits.length} visits for ${patient.regNumber}?`)) patient.visits.forEach(v => deleteVisit(v.id)); }}>Delete</button>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                            <button className="btn btn-export btn-small" onClick={exportData} style={{ flex: 1 }}>📤 Export Backup</button>
                            <button className="btn btn-secondary btn-small" onClick={importData} style={{ flex: 1 }}>📥 Import Backup</button>
                            {visits.length > 0 && <button className="btn btn-danger btn-small" onClick={clearAllData} style={{ flex: 1 }}>🗑 Clear All</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <header className="header">
                <h1>🫁 PT Tablet Follow-up</h1>
                <p>Track tablet distribution & manage follow-up schedules</p>

                {/* Google Sync Bar */}
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {!isSignedIn ? (
                        <button onClick={handleSignIn} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#1f1f1f', border: 'none', borderRadius: '8px', padding: '0.45rem 0.9rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', fontFamily: 'var(--font-body)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                            Sign in with Google
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                            {userProfile?.picture && <img src={userProfile.picture} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />}
                            <span style={{ fontSize: '0.78rem', color: 'white', fontWeight: 600 }}>{userProfile?.name || 'Signed in'}</span>
                            <SyncBadge />
                            <button onClick={() => setShowSyncSetup(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}>👥 Team</button>
                            <button onClick={handleSignOut} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.8)', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.72rem', cursor: 'pointer' }}>Sign out</button>
                        </div>
                    )}
                    {syncError && <span style={{ fontSize: '0.72rem', color: '#FCA5A5' }}>{syncError}</span>}
                </div>

                {!hasHolidayData(currentYear) && <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(245, 158, 11, 0.2)', borderRadius: '8px', fontSize: '0.78rem', color: '#FDE68A' }}>⚠️ Holiday data not available for {currentYear}.</div>}
                <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '0.5rem 0.85rem', textAlign: 'center', minWidth: '85px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'white', opacity: 0.8, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Total Patients</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'white', lineHeight: 1, fontFamily: 'var(--font-display)' }}>{uniquePatientCounts.total}</div>
                </div>
            </header>

            {/* STATS ROW */}
            <div className="stats-grid">
                <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)', color: 'white', border: 'none', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)' }}>
                    <div className="stat-date" style={{ fontSize: '0.7rem', marginBottom: '0.4rem', marginTop: 0, color: 'white', opacity: 0.85 }}>Unique Patients Today</div>
                    <div className="stat-value" style={{ fontSize: '3.2rem', color: 'white' }}>{pendingToday}</div>
                    <div className="stat-label" style={{ fontSize: '0.8rem', color: 'white', opacity: 0.85 }}>Pending Follow-ups</div>
                </div>
                <div className="stat-card clickable" onClick={() => openModalForDate(new Date())} style={{ cursor: 'pointer' }}>
                    <div className="stat-date" style={{ fontSize: '0.7rem', marginBottom: '0.4rem', marginTop: 0 }}>{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                    <div className="stat-value" style={{ fontSize: '3.2rem' }}>{new Date().getDate()}</div>
                    <div className="stat-label" style={{ fontSize: '0.8rem' }}>Today — {pendingToday} Patients</div>
                </div>
            </div>

            {/* NEXT 6 DAYS */}
            <div className="stats-grid-2">
                {getNext6Visits().map((v, i) => (
                    <div key={i} className="stat-card clickable" onClick={() => openModalForDate(v.fullDate)} style={{ cursor: 'pointer' }}>
                        <div className="stat-date" style={{ fontSize: '0.65rem', marginBottom: '0.35rem', marginTop: 0 }}>{v.month}</div>
                        <div className="stat-value" style={{ fontSize: '2.2rem' }}>{v.day}</div>
                        <div className="stat-label" style={{ fontSize: '0.65rem' }}>Day {i + 1}<br />{v.count} PT</div>
                    </div>
                ))}
                <div className="stat-card clickable" onClick={() => setShowMonthCalendar(true)} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', border: 'none' }}>
                    <div className="stat-date" style={{ fontSize: '0.65rem', marginBottom: '0.35rem', marginTop: 0, color: 'white', opacity: 0.85 }}>{currentYear}</div>
                    <div className="stat-value" style={{ fontSize: '1.3rem', color: 'white' }}>{new Date().toLocaleDateString('en-US', { month: 'short' })}</div>
                    <div className="stat-label" style={{ fontSize: '0.65rem', color: 'white', opacity: 0.85 }}>Month</div>
                </div>
                <div className="stat-card clickable" onClick={() => setShowYearView(true)} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)', color: 'white', border: 'none' }}>
                    <div className="stat-date" style={{ fontSize: '0.65rem', marginBottom: '0.35rem', marginTop: 0, color: 'white', opacity: 0.85 }}>Full Year</div>
                    <div className="stat-value" style={{ fontSize: '1.8rem', color: 'white' }}>{currentYear}</div>
                    <div className="stat-label" style={{ fontSize: '0.65rem', color: 'white', opacity: 0.85 }}>Overview</div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="main-content" style={{ gridTemplateColumns: '1fr' }}>
                <div className="card">
                    <h2 className="card-title">Assign Tablets</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ position: 'relative' }}>
                            <label className="form-label">PT Registration Number *</label>
                            <input type="text" className="form-input" value={regNumber} onChange={handleRegNumberChange} onFocus={() => setShowRegSuggestions(true)} onBlur={() => setTimeout(() => setShowRegSuggestions(false), 200)} placeholder="2026/ABC/0001" maxLength={14} required autoFocus style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', letterSpacing: '0.5px' }} />
                            {showRegSuggestions && regNumberSuggestions.length > 0 && <SuggestionDropdown suggestions={regNumberSuggestions} onSelect={v => { setRegNumber(v); setShowRegSuggestions(false); }} style={{ maxHeight: '180px' }} />}
                            {regNumber && patientTabletData[regNumber.trim().toUpperCase()] && <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.7rem', background: 'var(--primary-100)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>Existing Patient — Total so far: <strong>{getPatientTotalTablets(regNumber)} days</strong></div>}
                        </div>
                        <div className="form-group"><label className="form-label">Visit Date *</label><input type="date" className="form-input" value={visitDate} onChange={e => setVisitDate(e.target.value)} required /></div>
                        <div className="form-group"><label className="form-label">Next Visit Date *</label><input type="date" className="form-input" value={nextVisitDate} onChange={e => setNextVisitDate(e.target.value)} required /></div>
                        {visitDate && nextVisitDate && (
                            <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)', borderRadius: 'var(--radius-md)', color: 'white' }}>
                                <div style={{ fontSize: '0.72rem', opacity: 0.9, marginBottom: '0.2rem' }}>Tablets to be given:</div>
                                <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{calculateTabletDays(visitDate, nextVisitDate)} days</div>
                                {regNumber && <div style={{ fontSize: '0.72rem', opacity: 0.9, marginTop: '0.35rem' }}>New total: {getPatientTotalTablets(regNumber) + calculateTabletDays(visitDate, nextVisitDate)} days</div>}
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }}>Add Next Visit</button>
                        <button type="button" className="btn btn-lookup" onClick={() => setShowLookup(true)} style={{ width: '100%' }}>🔍 Look Up Patient Records</button>
                    </form>

                    {visits.length > 0 && (
                        <>
                            <h3 className="card-title" style={{ marginTop: '1.75rem' }}>Recent Entries</h3>
                            <div style={{ background: 'var(--primary-50)', padding: '0.6rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Latest visit per patient. Use <strong>Look Up</strong> for full history.</div>
                            <div className="patient-list">
                                {Object.values(patientTabletData).sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate)).slice(0, 12).map(patient => {
                                    const latest = patient.visits[patient.visits.length - 1];
                                    return (
                                        <div key={patient.regNumber} className={`patient-item ${latest.completed ? 'completed' : ''}`}>
                                            <div className="patient-info">
                                                <div className="patient-reg">{patient.regNumber}</div>
                                                <div className="patient-date">{formatDate(latest.visitDate)} → {formatDate(latest.nextVisitDate)}</div>
                                                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                                                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>📊 {latest.tabletDays}d</span>
                                                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>💊 Total: {patient.totalTabletDays}d</span>
                                                    <span style={{ color: 'var(--text-tertiary)' }}>🔢 {patient.visits.length}</span>
                                                </div>
                                            </div>
                                            <button className="btn btn-secondary btn-small" onClick={() => openPatientHistory(patient.regNumber)}>History</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* MONTH VIEW MODAL */}
            {showMonthView && selectedMonth !== null && (
                <div className="modal-overlay" onClick={() => setShowMonthView(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
                        <div className="modal-header"><div className="modal-title">{MONTHS[selectedMonth]} {currentYear}</div><button className="modal-close" onClick={() => setShowMonthView(false)}>×</button></div>
                        <div className="month-view-calendar">
                            {getMonthDatesDetailed(selectedMonth).map(d => {
                                let cls = 'month-view-date';
                                if (d.isToday) cls += ' today'; if (d.isSunday) cls += ' sunday';
                                if (d.holiday) cls += d.holiday.type === 'poya' ? ' poya' : ' holiday';
                                return (
                                    <div key={d.day} className={cls} onClick={() => d.count > 0 && openModalForDate(d.date)}>
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
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1100px' }}>
                        <div className="modal-header"><div className="modal-title">Full Year — {currentYear}</div><button className="modal-close" onClick={() => setShowYearView(false)}>×</button></div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem' }}>
                            {MONTHS.map((month, index) => { const count = getUniquePatientsForMonth(index); return (
                                <div key={month} style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.15rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-display)' }}>{month.slice(0, 3)}</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{count}</div>
                                </div>
                            ); })}
                        </div>
                        <div style={{ marginTop: '1.5rem', padding: '1.15rem', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Total Unique Patients</div>
                            <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>{uniquePatientCounts.total}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.3rem' }}>({visits.length} total entries)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* CURRENT MONTH CALENDAR MODAL */}
            {showMonthCalendar && (
                <div className="modal-overlay" onClick={() => setShowMonthCalendar(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                        <div className="modal-header"><div className="modal-title">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div><button className="modal-close" onClick={() => setShowMonthCalendar(false)}>×</button></div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
                            {Array.from({ length: new Date(currentYear, new Date().getMonth() + 1, 0).getDate() }, (_, i) => {
                                const date = new Date(currentYear, new Date().getMonth(), i + 1);
                                const count = getUniquePatientsForDate(date);
                                const isToday = date.toDateString() === new Date().toDateString();
                                return (
                                    <div key={i} onClick={() => openModalForDate(date)} style={{ background: isToday ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' : 'var(--bg-input)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 0.5rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', color: isToday ? 'white' : 'inherit' }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.2rem', fontFamily: 'var(--font-display)' }}>{i + 1}</div>
                                        <div style={{ fontSize: '0.7rem', color: isToday ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)', fontWeight: 600 }}>{count} PT</div>
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
                        <div className="modal-header"><div className="modal-title">📋 {modalDate}</div><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
                        {modalPatients.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📋</div><p>No patients scheduled for this date</p></div> : (
                            <>
                                <div style={{ background: 'var(--primary-50)', padding: '0.65rem 0.85rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                    <strong style={{ color: 'var(--primary)' }}>{new Set(modalPatients.filter(v => !v.completed).map(v => v.regNumber.trim().toUpperCase())).size}</strong> unique patients pending
                                </div>
                                <div className="patient-list">
                                    {modalPatients.map(visit => (
                                        <div key={visit.id} className={`patient-item ${visit.completed ? 'completed' : ''}`}>
                                            <div className="patient-info"><div className="patient-reg">{visit.regNumber}</div><div className="patient-date">{visit.completed ? 'Completed ✓' : 'Pending'}</div></div>
                                            <div className="patient-actions"><input type="checkbox" className="checkbox" checked={visit.completed} onChange={() => toggleCompleted(visit.id)} /></div>
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
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header"><div className="modal-title">📊 Tablet History</div><button className="modal-close" onClick={() => setShowPatientHistory(false)}>×</button></div>
                        <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', padding: '1.5rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>{selectedPatient.regNumber}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '0.75rem' }}>
                                <div><div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.15rem' }}>Total Tablets</div><div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{selectedPatient.totalTabletDays}</div><div style={{ fontSize: '0.7rem', opacity: 0.8 }}>days</div></div>
                                <div><div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.15rem' }}>Total Visits</div><div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{selectedPatient.visits.length}</div><div style={{ fontSize: '0.7rem', opacity: 0.8 }}>visits</div></div>
                            </div>
                        </div>
                        <h3 style={{ marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Visit History</h3>
                        <div className="patient-list" style={{ maxHeight: '350px' }}>
                            {selectedPatient.visits.map((visit, index) => (
                                <div key={visit.id} style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.6rem', border: '1.5px solid var(--border)', borderLeft: '4px solid var(--success)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                                        <div><div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '0.1rem' }}>Visit #{selectedPatient.visits.length - index}</div><div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatDate(visit.visitDate)}</div></div>
                                        <div style={{ background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)', color: 'white', padding: '0.35rem 0.75rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.95rem' }}>{visit.tabletDays}d</div>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}><div>Next: {formatDate(visit.nextVisitDate)}</div><div>{visit.completed ? '✅ Completed' : '⏳ Pending'}</div></div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--success-light)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Treatment Duration</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--success)' }}>{formatDate(selectedPatient.firstVisitDate)} → {formatDate(selectedPatient.lastNextVisitDate)}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>({Math.ceil((new Date(selectedPatient.lastNextVisitDate) - new Date(selectedPatient.firstVisitDate)) / 86400000)} days)</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PTVisitTracker />);
