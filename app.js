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
    const [syncing, setSyncing] = useState(false);
    const [googleScriptUrl, setGoogleScriptUrl] = useState(localStorage.getItem('googleScriptUrl') || '');
    const [showSetup, setShowSetup] = useState(!localStorage.getItem('googleScriptUrl'));
    const [showPatientHistory, setShowPatientHistory] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showRegSuggestions, setShowRegSuggestions] = useState(false);
    const [showLookupSuggestions, setShowLookupSuggestions] = useState(false);

    // Load data from Google Sheets when component mounts
    useEffect(() => {
        if (googleScriptUrl) {
            loadDataFromGoogle();
        }
    }, [googleScriptUrl]);

    // OPTIMIZATION: Memoized calculations for unique patients
    const uniquePatientCounts = useMemo(() => {
        const counts = {
            byMonth: {},
            byDate: {},
            total: new Set()
        };

        visits.forEach(visit => {
            const visitDate = new Date(visit.nextVisitDate);
            const month = visitDate.getMonth();
            const dateKey = visitDate.toDateString();
            const regNum = visit.regNumber.trim().toUpperCase();

            // Track unique patients overall
            counts.total.add(regNum);

            // Track unique patients by month
            if (!counts.byMonth[month]) {
                counts.byMonth[month] = new Set();
            }
            if (!visit.completed) {
                counts.byMonth[month].add(regNum);
            }

            // Track unique patients by date
            if (!counts.byDate[dateKey]) {
                counts.byDate[dateKey] = new Set();
            }
            if (!visit.completed) {
                counts.byDate[dateKey].add(regNum);
            }
        });

        return {
            byMonth: Object.fromEntries(
                Object.entries(counts.byMonth).map(([k, v]) => [k, v.size])
            ),
            byDate: Object.fromEntries(
                Object.entries(counts.byDate).map(([k, v]) => [k, v.size])
            ),
            total: counts.total.size
        };
    }, [visits]);

    // TABLET TRACKING: Calculate cumulative tablet days per patient
    const patientTabletData = useMemo(() => {
        const patientData = {};

        visits.forEach(visit => {
            const regNum = visit.regNumber.trim().toUpperCase();
            
            if (!patientData[regNum]) {
                patientData[regNum] = {
                    regNumber: visit.regNumber,
                    totalTabletDays: 0,
                    visits: [],
                    firstVisitDate: visit.visitDate,
                    lastVisitDate: visit.visitDate,
                    lastNextVisitDate: visit.nextVisitDate
                };
            }

            patientData[regNum].totalTabletDays += visit.tabletDays;
            patientData[regNum].visits.push(visit);
            
            // Track date range
            if (new Date(visit.visitDate) < new Date(patientData[regNum].firstVisitDate)) {
                patientData[regNum].firstVisitDate = visit.visitDate;
            }
            if (new Date(visit.visitDate) > new Date(patientData[regNum].lastVisitDate)) {
                patientData[regNum].lastVisitDate = visit.visitDate;
            }
            // Track the last scheduled next visit date
            if (new Date(visit.nextVisitDate) > new Date(patientData[regNum].lastNextVisitDate)) {
                patientData[regNum].lastNextVisitDate = visit.nextVisitDate;
            }
        });

        // Sort visits by date for each patient
        Object.values(patientData).forEach(patient => {
            patient.visits.sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate));
        });

        return patientData;
    }, [visits]);

    // Helper function to get patient's cumulative tablet days
    const getPatientTotalTablets = useCallback((regNumber) => {
        const regNum = regNumber.trim().toUpperCase();
        return patientTabletData[regNum]?.totalTabletDays || 0;
    }, [patientTabletData]);

    // Helper function to calculate tablet days
    const calculateTabletDays = (visitDate, nextVisitDate) => {
        const visit = new Date(visitDate);
        const next = new Date(nextVisitDate);
        const diffTime = next - visit;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    // Auto-format PT Registration Number: YYYY/AAA/0000
    const formatRegNumber = (value) => {
        // Remove all non-alphanumeric characters
        let cleaned = value.replace(/[^a-zA-Z0-9]/g, '');
        
        let formatted = '';
        
        // First 4 characters: Year (digits only)
        if (cleaned.length > 0) {
            formatted = cleaned.slice(0, 4);
        }
        
        // After 4 digits, add slash and letters
        if (cleaned.length > 4) {
            formatted += '/' + cleaned.slice(4, 7).toUpperCase();
        }
        
        // After 7 characters, add slash and final digits
        if (cleaned.length > 7) {
            formatted += '/' + cleaned.slice(7, 11);
        }
        
        return formatted;
    };

    // Handle PT Registration Number input with formatting
    const handleRegNumberChange = (e) => {
        const input = e.target.value;
        const formatted = formatRegNumber(input);
        setRegNumber(formatted);
        setShowRegSuggestions(formatted.length > 0);
    };

    // OPTIMIZATION: Memoized function to get unique patient count for a specific date
    const getUniquePatientsForDate = useCallback((date) => {
        const dateKey = new Date(date).toDateString();
        return uniquePatientCounts.byDate[dateKey] || 0;
    }, [uniquePatientCounts]);

    // OPTIMIZATION: Memoized function to get unique patient count for a month
    const getUniquePatientsForMonth = useCallback((monthIndex) => {
        return uniquePatientCounts.byMonth[monthIndex] || 0;
    }, [uniquePatientCounts]);

    const callGoogleScript = async (action, data = {}) => {
        if (!googleScriptUrl) {
            alert('Please setup Google Sheets connection first!');
            return null;
        }

        try {
            setSyncing(true);
            
            const response = await fetch(googleScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ...data
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('Success:', action, result.message || 'OK');
                
                if (action !== 'getAllVisits') {
                    await loadDataFromGoogle();
                }
            } else {
                console.error('Server error:', result.error);
                alert('Error: ' + (result.error || 'Unknown error'));
            }
            
            return result;
            
        } catch (error) {
            console.error('Error calling Google Script:', error);
            alert('Error connecting to Google Sheets. Please check:\n1. Your internet connection\n2. The Web App URL is correct\n3. The script is deployed properly');
            return null;
        } finally {
            setSyncing(false);
        }
    };

    const loadDataFromGoogle = async () => {
        if (!googleScriptUrl) {
            const savedVisits = localStorage.getItem('ptVisits');
            if (savedVisits) {
                try {
                    const parsed = JSON.parse(savedVisits);
                    const visitsWithDates = parsed.map(visit => ({
                        ...visit,
                        visitDate: visit.visitDate ? new Date(visit.visitDate) : new Date(visit.recordedAt || visit.nextVisitDate),
                        nextVisitDate: new Date(visit.nextVisitDate),
                        recordedAt: new Date(visit.recordedAt),
                        tabletDays: visit.tabletDays || 0
                    }));
                    setVisits(visitsWithDates);
                } catch (e) {
                    console.error('Error loading from local storage:', e);
                }
            }
            return;
        }

        try {
            setSyncing(true);
            
            const response = await fetch(googleScriptUrl + '?action=getAllVisits');
            const result = await response.json();
            
            if (result.success && result.visits) {
                const visitsWithDates = result.visits.map(visit => ({
                    ...visit,
                    visitDate: visit.visitDate ? new Date(visit.visitDate) : new Date(visit.recordedAt || visit.nextVisitDate),
                    nextVisitDate: new Date(visit.nextVisitDate),
                    recordedAt: new Date(visit.recordedAt),
                    completedAt: visit.completedAt ? new Date(visit.completedAt) : null,
                    tabletDays: visit.tabletDays || 0
                }));
                setVisits(visitsWithDates);
                
                localStorage.setItem('ptVisits', JSON.stringify(visitsWithDates));
                
                console.log('Loaded', visitsWithDates.length, 'visits from Google Sheets');
            } else {
                console.warn('No visits data returned or error:', result.error);
            }
            
        } catch (error) {
            console.error('Error loading data from Google Sheets:', error);
            
            const savedVisits = localStorage.getItem('ptVisits');
            if (savedVisits) {
                try {
                    const parsed = JSON.parse(savedVisits);
                    const visitsWithDates = parsed.map(visit => ({
                        ...visit,
                        visitDate: visit.visitDate ? new Date(visit.visitDate) : new Date(visit.recordedAt || visit.nextVisitDate),
                        nextVisitDate: new Date(visit.nextVisitDate),
                        recordedAt: new Date(visit.recordedAt),
                        tabletDays: visit.tabletDays || 0
                    }));
                    setVisits(visitsWithDates);
                    console.log('Loaded from local storage (Google Sheets failed)');
                } catch (e) {
                    console.error('Error loading from local storage:', e);
                }
            }
        } finally {
            setSyncing(false);
        }
    };

    const saveGoogleScriptUrl = () => {
        if (googleScriptUrl.trim()) {
            localStorage.setItem('googleScriptUrl', googleScriptUrl.trim());
            setShowSetup(false);
            loadDataFromGoogle();
            alert('Google Sheets connected successfully!');
        } else {
            alert('Please enter a valid Google Script URL');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!regNumber || !visitDate || !nextVisitDate) {
            alert('Please fill in all required fields');
            return;
        }

        // Validate PT Registration Number format: YYYY/AAA/0000
        const regNumberPattern = /^\d{4}\/[A-Z]{3}\/\d{4}$/;
        if (!regNumberPattern.test(regNumber)) {
            alert('Invalid PT Registration Number format!\n\nRequired format: YYYY/AAA/0000\nExample: 2026/ABC/0001\n\n- First 4 digits: Year\n- 3 letters: Code (uppercase)\n- Last 4 digits: Number');
            return;
        }

        const visit = new Date(visitDate);
        const nextVisit = new Date(nextVisitDate);

        // Validation: Next visit date must be after visit date
        if (nextVisit <= visit) {
            alert('Next Visit Date must be after Visit Date');
            return;
        }

        // Calculate tablet days
        const tabletDays = calculateTabletDays(visitDate, nextVisitDate);

        // Get current total for this patient
        const currentTotal = getPatientTotalTablets(regNumber);
        const newTotal = currentTotal + tabletDays;

        const newVisit = {
            id: Date.now(),
            regNumber: regNumber.trim(),
            visitDate: visit,
            nextVisitDate: nextVisit,
            tabletDays: tabletDays,
            completed: false,
            recordedAt: new Date()
        };

        // Save to Google Sheets
        const result = await callGoogleScript('addVisit', { visit: newVisit });
        
        if (result && result.success) {
            alert(`✅ Visit recorded successfully!\n\n` +
                  `Tablets given this visit: ${tabletDays} days\n` +
                  `Total tablets for ${regNumber}: ${newTotal} days`);
            setRegNumber('');
            setVisitDate(new Date().toISOString().split('T')[0]);
            setNextVisitDate('');
        } else {
            const updatedVisits = [newVisit, ...visits];
            setVisits(updatedVisits);
            localStorage.setItem('ptVisits', JSON.stringify(updatedVisits));
            alert(`✅ Visit recorded successfully!\n\n` +
                  `Tablets given this visit: ${tabletDays} days\n` +
                  `Total tablets for ${regNumber}: ${newTotal} days`);
            setRegNumber('');
            setVisitDate(new Date().toISOString().split('T')[0]);
            setNextVisitDate('');
        }
    };

    const deleteVisit = async (id) => {
        if (confirm('Are you sure you want to delete this entry?')) {
            await callGoogleScript('deleteVisit', { id });
            
            const updatedVisits = visits.filter(v => v.id !== id);
            setVisits(updatedVisits);
            localStorage.setItem('ptVisits', JSON.stringify(updatedVisits));
            
            if (updatedVisits.length === 0) {
                localStorage.removeItem('ptVisits');
            }
        }
    };

    const clearAllData = async () => {
        if (confirm('⚠️ WARNING: This will delete ALL patient data from Google Sheets permanently. Are you sure?')) {
            if (confirm('This action cannot be undone. Delete everything?')) {
                await callGoogleScript('clearAllData');
                setVisits([]);
                localStorage.removeItem('ptVisits');
                alert('All data has been cleared from Google Sheets.');
            }
        }
    };

    const toggleCompleted = async (id) => {
        const visit = visits.find(v => v.id === id);
        if (visit) {
            const updatedVisit = {
                ...visit,
                completed: !visit.completed,
                completedAt: !visit.completed ? new Date() : null
            };
            
            await callGoogleScript('updateVisit', { visit: updatedVisit });
            
            const updatedVisits = visits.map(v => 
                v.id === id ? updatedVisit : v
            );
            setVisits(updatedVisits);
            localStorage.setItem('ptVisits', JSON.stringify(updatedVisits));
        }
    };

    const getPatientsForDate = (date) => {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        
        return visits.filter(visit => {
            const visitDate = new Date(visit.nextVisitDate);
            visitDate.setHours(0, 0, 0, 0);
            return visitDate.getTime() === targetDate.getTime();
        });
    };

    const getHolidaysForMonth = (monthIndex) => {
        return SRI_LANKAN_HOLIDAYS_2026[monthIndex] || [];
    };

    const getHolidayForDate = (date) => {
        const month = date.getMonth();
        const day = date.getDate();
        const holidays = SRI_LANKAN_HOLIDAYS_2026[month] || [];
        return holidays.find(h => h.date === day);
    };

    const openMonthView = (monthIndex) => {
        setSelectedMonth(monthIndex);
        setShowMonthView(true);
    };

    // OPTIMIZATION: Only calculate detailed dates when month view is open
    const getMonthDatesDetailed = useCallback((monthIndex) => {
        const year = new Date().getFullYear();
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        
        const dates = [];
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, monthIndex, day);
            date.setHours(0, 0, 0, 0);
            
            const patientsForDate = visits.filter(visit => {
                const visitDate = new Date(visit.nextVisitDate);
                visitDate.setHours(0, 0, 0, 0);
                return visitDate.getTime() === date.getTime() && !visit.completed;
            });
            
            // Get unique patient count for this date
            const uniquePatients = new Set(
                patientsForDate.map(v => v.regNumber.trim().toUpperCase())
            );
            
            const holiday = getHolidayForDate(date);
            
            dates.push({
                date: date,
                day: day,
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                count: uniquePatients.size,
                patients: patientsForDate,
                holiday: holiday,
                isToday: date.getTime() === new Date().setHours(0, 0, 0, 0),
                isSunday: date.getDay() === 0
            });
        }
        
        return dates;
    }, [visits]);

    const getNext6Visits = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const result = [];
        
        for (let i = 1; i <= 6; i++) {
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + i);
            
            const count = getUniquePatientsForDate(nextDate);
            
            result.push({
                day: nextDate.getDate(),
                month: nextDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                count: count,
                fullDate: nextDate
            });
        }
        
        return result;
    };

    // LOOKUP FEATURE: Get patient statistics
    const lookupStats = useMemo(() => {
        const uniquePatients = new Set(
            visits.map(v => v.regNumber.trim().toUpperCase())
        );
        
        return {
            totalEntries: visits.length,
            uniquePatients: uniquePatients.size
        };
    }, [visits]);

    // AUTOCOMPLETE: Get suggestions for registration numbers
    const getRegNumberSuggestions = useCallback((searchTerm) => {
        if (!searchTerm || searchTerm.length < 1) return [];
        
        const search = searchTerm.toUpperCase().trim();
        const allRegNumbers = Object.keys(patientTabletData);
        
        // Match by: full number, or last 4 digits
        return allRegNumbers.filter(regNum => {
            const upper = regNum.toUpperCase();
            // Extract last 4 characters (usually the numeric part)
            const last4 = regNum.slice(-4);
            return upper.includes(search) || last4.includes(search);
        }).slice(0, 10); // Limit to 10 suggestions
    }, [patientTabletData]);

    // Get current suggestions based on input
    const regNumberSuggestions = useMemo(() => {
        return getRegNumberSuggestions(regNumber);
    }, [regNumber, getRegNumberSuggestions]);

    const lookupSuggestions = useMemo(() => {
        return getRegNumberSuggestions(lookupSearch);
    }, [lookupSearch, getRegNumberSuggestions]);

    const openPatientHistory = (regNumber) => {
        const regNum = regNumber.trim().toUpperCase();
        const patientInfo = patientTabletData[regNum];
        if (patientInfo) {
            setSelectedPatient(patientInfo);
            setShowPatientHistory(true);
        }
    };

    const openModalForDate = (date) => {
        setSelectedDate(date);
        setShowModal(true);
        setShowMonthCalendar(false);
    };

    const getTodayPatients = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return visits.filter(visit => {
            const visitDate = new Date(visit.nextVisitDate);
            visitDate.setHours(0, 0, 0, 0);
            return visitDate.getTime() === today.getTime();
        });
    };

    const getPendingTodayCount = () => {
        const todayPatients = getTodayPatients();
        const uniquePatients = new Set(
            todayPatients
                .filter(v => !v.completed)
                .map(v => v.regNumber.trim().toUpperCase())
        );
        return uniquePatients.size;
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    };

    const todayPatients = getTodayPatients();
    const pendingToday = getPendingTodayCount();
    const modalPatients = selectedDate ? getPatientsForDate(selectedDate) : [];
    const modalDate = selectedDate ? selectedDate.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
    }) : '';

    return (
        <div className="app-container">
            {showSetup && (
                <div className="modal-overlay" style={{zIndex: 2000}}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
                        <div className="modal-header">
                            <div className="modal-title">🔗 Connect to Google Sheets</div>
                        </div>
                        
                        <div style={{marginBottom: '1.5rem'}}>
                            <p style={{marginBottom: '1rem', color: 'var(--text-secondary)'}}>
                                To save your data to Google Sheets, paste your Google Apps Script Web App URL below:
                            </p>
                            
                            <div className="form-group">
                                <label className="form-label">Google Script Web App URL</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={googleScriptUrl}
                                    onChange={(e) => setGoogleScriptUrl(e.target.value)}
                                    placeholder="https://script.google.com/macros/s/..."
                                />
                            </div>
                            
                            <button 
                                className="btn btn-primary" 
                                onClick={saveGoogleScriptUrl}
                                style={{width: '100%', marginBottom: '1rem'}}
                            >
                                Connect to Google Sheets
                            </button>
                            
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setShowSetup(false)}
                                style={{width: '100%'}}
                            >
                                Skip for Now (Use Browser Storage)
                            </button>
                        </div>
                        
                        <div style={{
                            background: 'var(--bg-main)', 
                            padding: '1rem', 
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)'
                        }}>
                            <strong>Need help?</strong> Check the setup instructions file included with this app.
                        </div>
                    </div>
                </div>
            )}

            {syncing && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: 'white',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    zIndex: 2000,
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <div style={{
                        width: '20px',
                        height: '20px',
                        border: '3px solid var(--border)',
                        borderTopColor: 'var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }}></div>
                    <span style={{fontSize: '0.9rem', color: 'var(--text-primary)'}}>Syncing...</span>
                </div>
            )}

            {/* LOOKUP MODAL */}
            {showLookup && (
                <div className="modal-overlay" onClick={() => setShowLookup(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '800px'}}>
                        <div className="modal-header">
                            <div className="modal-title">🔍 Look Up Patient Records</div>
                            <button className="modal-close" onClick={() => setShowLookup(false)}>×</button>
                        </div>
                        
                        <div className="lookup-stats">
                            <div className="lookup-stat">
                                <div className="lookup-stat-value">{lookupStats.uniquePatients}</div>
                                <div className="lookup-stat-label">Unique Patients</div>
                            </div>
                            <div className="lookup-stat">
                                <div className="lookup-stat-value">{lookupStats.totalEntries}</div>
                                <div className="lookup-stat-label">Total Visit Entries</div>
                            </div>
                        </div>

                        <div className="search-box" style={{position: 'relative'}}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search by registration number or last 4 digits..."
                                value={lookupSearch}
                                onChange={(e) => {
                                    setLookupSearch(e.target.value);
                                    setShowLookupSuggestions(true);
                                }}
                                onFocus={() => setShowLookupSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowLookupSuggestions(false), 200)}
                                autoFocus
                            />
                            {showLookupSuggestions && lookupSuggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '2px solid var(--primary)',
                                    borderRadius: '8px',
                                    maxHeight: '250px',
                                    overflowY: 'auto',
                                    zIndex: 1000,
                                    boxShadow: 'var(--shadow-lg)',
                                    marginTop: '0.25rem'
                                }}>
                                    {lookupSuggestions.map(suggestion => {
                                        const patient = patientTabletData[suggestion.toUpperCase()];
                                        return (
                                            <div
                                                key={suggestion}
                                                onClick={() => {
                                                    setLookupSearch(patient.regNumber);
                                                    setShowLookupSuggestions(false);
                                                }}
                                                style={{
                                                    padding: '0.75rem 1rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border)',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.background = 'var(--bg-main)'}
                                                onMouseLeave={(e) => e.target.style.background = 'white'}
                                            >
                                                <div style={{
                                                    fontWeight: 600,
                                                    color: 'var(--primary)',
                                                    fontFamily: 'JetBrains Mono, monospace',
                                                    marginBottom: '0.25rem'
                                                }}>
                                                    {patient.regNumber}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-secondary)',
                                                    display: 'flex',
                                                    gap: '1rem'
                                                }}>
                                                    <span>💊 {patient.totalTabletDays} days</span>
                                                    <span>🔢 {patient.visits.length} visits</span>
                                                    <span>Last: {formatDate(patient.lastVisitDate)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        
                        <div className="patient-list" style={{maxHeight: '400px'}}>
                            {(() => {
                                // Filter patients based on search
                                const filteredPatients = Object.values(patientTabletData).filter(patient =>
                                    !lookupSearch.trim() || 
                                    patient.regNumber.toUpperCase().includes(lookupSearch.trim().toUpperCase())
                                );
                                
                                if (filteredPatients.length === 0) {
                                    return (
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📋</div>
                                            <p>No patients found</p>
                                        </div>
                                    );
                                }
                                
                                return filteredPatients
                                    .sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate))
                                    .map(patient => {
                                        const latestVisit = patient.visits[patient.visits.length - 1];
                                        const pendingVisits = patient.visits.filter(v => !v.completed).length;
                                        
                                        return (
                                            <div key={patient.regNumber} className="patient-item" style={{
                                                border: '2px solid var(--border)',
                                                background: 'white'
                                            }}>
                                                <div className="patient-info">
                                                    <div className="patient-reg">{patient.regNumber}</div>
                                                    <div className="patient-date">
                                                        Latest visit: {formatDate(latestVisit.visitDate)} → Next: {formatDate(latestVisit.nextVisitDate)}
                                                    </div>
                                                    <div className="patient-date" style={{fontSize: '0.75rem', marginTop: '0.25rem'}}>
                                                        First visit: {formatDate(patient.firstVisitDate)}
                                                    </div>
                                                    <div style={{
                                                        marginTop: '0.75rem',
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                                        gap: '0.5rem',
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        <div style={{
                                                            background: '#e3f2fd',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            textAlign: 'center'
                                                        }}>
                                                            <div style={{fontWeight: 700, color: 'var(--primary)', fontSize: '1.2rem'}}>
                                                                {patient.totalTabletDays}
                                                            </div>
                                                            <div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>
                                                                Total Tablets
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            background: '#f3e5f5',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            textAlign: 'center'
                                                        }}>
                                                            <div style={{fontWeight: 700, color: '#9c27b0', fontSize: '1.2rem'}}>
                                                                {patient.visits.length}
                                                            </div>
                                                            <div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>
                                                                Total Visits
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            background: pendingVisits > 0 ? '#fff3e0' : '#e8f5e9',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            textAlign: 'center'
                                                        }}>
                                                            <div style={{fontWeight: 700, color: pendingVisits > 0 ? '#f57c00' : '#2e7d32', fontSize: '1.2rem'}}>
                                                                {pendingVisits}
                                                            </div>
                                                            <div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>
                                                                Pending
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="patient-actions" style={{flexDirection: 'column', gap: '0.5rem'}}>
                                                    <button 
                                                        className="btn btn-primary btn-small"
                                                        onClick={() => openPatientHistory(patient.regNumber)}
                                                    >
                                                        View History
                                                    </button>
                                                    <button 
                                                        className="btn btn-danger btn-small"
                                                        onClick={() => {
                                                            if (confirm(`Delete all ${patient.visits.length} visits for ${patient.regNumber}?`)) {
                                                                patient.visits.forEach(visit => deleteVisit(visit.id));
                                                            }
                                                        }}
                                                    >
                                                        Delete All
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    });
                            })()}
                        </div>

                        {visits.length > 0 && (
                            <button 
                                className="btn btn-danger" 
                                onClick={clearAllData}
                                style={{width: '100%', marginTop: '1rem'}}
                            >
                                Clear All Data
                            </button>
                        )}
                    </div>
                </div>
            )}

            <header className="header">
                <h1>PT Tablet Follow-up</h1>
                <p>Track tablet distribution and manage 2-month follow-up schedules</p>
                {googleScriptUrl && (
                    <button 
                        onClick={() => setShowSetup(true)}
                        style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        ⚙️ Google Sheets Settings
                    </button>
                )}
                <div style={{
                    position: 'absolute',
                    bottom: '1rem',
                    right: '1rem',
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    textAlign: 'center',
                    minWidth: '80px'
                }}>
                    <div style={{
                        fontSize: '0.65rem',
                        color: 'white',
                        opacity: 0.85,
                        marginBottom: '0.25rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontWeight: 600
                    }}>
                        Total Patients
                    </div>
                    <div style={{
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        color: 'white',
                        lineHeight: 1
                    }}>
                        {uniquePatientCounts.total}
                    </div>
                </div>
            </header>

            <div className="stats-grid">
                <div 
                    className="stat-card" 
                    style={{background: 'linear-gradient(135deg, var(--secondary) 0%, #00aa70 100%)', color: 'white', border: 'none'}}
                >
                    <div className="stat-date" style={{fontSize: '0.75rem', marginBottom: '0.5rem', marginTop: 0, color: 'white', opacity: 0.9}}>
                        Unique Patients Today
                    </div>
                    <div className="stat-value" style={{fontSize: '3.5rem', color: 'white'}}>
                        {pendingToday}
                    </div>
                    <div className="stat-label" style={{fontSize: '0.85rem', color: 'white', opacity: 0.9}}>Pending Follow-ups</div>
                </div>
                <div 
                    className="stat-card clickable" 
                    onClick={() => openModalForDate(new Date())}
                    style={{cursor: 'pointer'}}
                >
                    <div className="stat-date" style={{fontSize: '0.75rem', marginBottom: '0.5rem', marginTop: 0}}>
                        {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                    <div className="stat-value" style={{fontSize: '3.5rem'}}>
                        {new Date().getDate()}
                    </div>
                    <div className="stat-label" style={{fontSize: '0.85rem'}}>Today - {pendingToday} Patients</div>
                </div>
            </div>

            <div className="stats-grid-2">
                {getNext6Visits().map((visitInfo, index) => (
                    <div 
                        key={index} 
                        className="stat-card clickable"
                        onClick={() => openModalForDate(visitInfo.fullDate)}
                        style={{cursor: 'pointer'}}
                    >
                        <div className="stat-date" style={{fontSize: '0.7rem', marginBottom: '0.5rem', marginTop: 0}}>
                            {visitInfo.month}
                        </div>
                        <div className="stat-value" style={{fontSize: '2.5rem'}}>
                            {visitInfo.day}
                        </div>
                        <div className="stat-label" style={{fontSize: '0.7rem'}}>Next {index + 1}<br/>{visitInfo.count} PT</div>
                    </div>
                ))}
                <div 
                    className="stat-card clickable" 
                    onClick={() => setShowMonthCalendar(true)}
                    style={{cursor: 'pointer', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white'}}
                >
                    <div className="stat-date" style={{fontSize: '0.7rem', marginBottom: '0.5rem', marginTop: 0, color: 'white', opacity: 0.9}}>
                        {new Date().getFullYear()}
                    </div>
                    <div className="stat-value" style={{fontSize: '1.5rem', color: 'white'}}>
                        {new Date().toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                    <div className="stat-label" style={{fontSize: '0.7rem', color: 'white', opacity: 0.9}}>Full Month</div>
                </div>
                <div 
                    className="stat-card clickable" 
                    onClick={() => setShowYearView(true)}
                    style={{cursor: 'pointer', background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)', color: 'white', border: 'none'}}
                >
                    <div className="stat-date" style={{fontSize: '0.7rem', marginBottom: '0.5rem', marginTop: 0, color: 'white', opacity: 0.9}}>
                        Full Year
                    </div>
                    <div className="stat-value" style={{fontSize: '2rem', color: 'white'}}>
                        {new Date().getFullYear()}
                    </div>
                    <div className="stat-label" style={{fontSize: '0.7rem', color: 'white', opacity: 0.9}}>All Data</div>
                </div>
            </div>

            <div className="main-content">
                <div className="card">
                    <h2 className="card-title">Assign Tablets</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{position: 'relative'}}>
                            <label className="form-label">PT Registration Number *</label>
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
                                style={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: '1.1rem',
                                    letterSpacing: '0.5px'
                                }}
                            />
                            {showRegSuggestions && regNumberSuggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '2px solid var(--primary)',
                                    borderRadius: '8px',
                                    maxHeight: '200px',
                                    overflowY: auto',
                                    zIndex: 1000,
                                    boxShadow: 'var(--shadow-lg)',
                                    marginTop: '0.25rem'
                                }}>
                                    {regNumberSuggestions.map(suggestion => {
                                        const patient = patientTabletData[suggestion.toUpperCase()];
                                        return (
                                            <div
                                                key={suggestion}
                                                onClick={() => {
                                                    setRegNumber(patient.regNumber);
                                                    setShowRegSuggestions(false);
                                                }}
                                                style={{
                                                    padding: '0.75rem 1rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border)',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.background = 'var(--bg-main)'}
                                                onMouseLeave={(e) => e.target.style.background = 'white'}
                                            >
                                                <div style={{
                                                    fontWeight: 600,
                                                    color: 'var(--primary)',
                                                    fontFamily: 'JetBrains Mono, monospace',
                                                    marginBottom: '0.25rem'
                                                }}>
                                                    {patient.regNumber}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-secondary)',
                                                    display: 'flex',
                                                    gap: '1rem'
                                                }}>
                                                    <span>💊 {patient.totalTabletDays} days</span>
                                                    <span>🔢 {patient.visits.length} visits</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {regNumber && patientTabletData[regNumber.trim().toUpperCase()] && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    padding: '0.5rem',
                                    background: '#e3f2fd',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    color: '#1976d2'
                                }}>
                                    <strong>Existing Patient</strong> - Total tablets so far: <strong>{getPatientTotalTablets(regNumber)} days</strong>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Visit Date *</label>
                            <input
                                type="date"
                                className="form-input"
                                value={visitDate}
                                onChange={(e) => setVisitDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Next Visit Date *</label>
                            <input
                                type="date"
                                className="form-input"
                                value={nextVisitDate}
                                onChange={(e) => setNextVisitDate(e.target.value)}
                                required
                            />
                        </div>

                        {visitDate && nextVisitDate && (
                            <div style={{
                                marginBottom: '1.25rem',
                                padding: '1rem',
                                background: 'linear-gradient(135deg, #00cc88 0%, #00aa70 100%)',
                                borderRadius: '8px',
                                color: 'white'
                            }}>
                                <div style={{fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem'}}>
                                    Tablets to be given:
                                </div>
                                <div style={{fontSize: '2rem', fontWeight: 700}}>
                                    {calculateTabletDays(visitDate, nextVisitDate)} days
                                </div>
                                {regNumber && (
                                    <div style={{fontSize: '0.75rem', opacity: 0.9, marginTop: '0.5rem'}}>
                                        New total: {getPatientTotalTablets(regNumber) + calculateTabletDays(visitDate, nextVisitDate)} days
                                    </div>
                                )}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            style={{width: '100%', marginBottom: '1rem'}}
                            disabled={syncing}
                        >
                            {syncing ? 'Saving...' : 'Add Next Visit'}
                        </button>

                        <button 
                            type="button"
                            className="btn btn-lookup" 
                            onClick={() => setShowLookup(true)}
                            style={{width: '100%'}}
                            disabled={syncing}
                        >
                            🔍 Look Up Patient Records
                        </button>
                    </form>

                    {visits.length > 0 && (
                        <>
                            <h3 className="card-title" style={{marginTop: '2rem'}}>Recent Entries</h3>
                            <div style={{
                                background: 'var(--bg-main)',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)'
                            }}>
                                Showing latest visit for each patient. 
                                Use <strong>Look Up</strong> button to view complete history.
                            </div>
                            <div className="patient-list">
                                {Object.values(patientTabletData)
                                    .sort((a, b) => new Date(b.lastVisitDate) - new Date(a.lastVisitDate))
                                    .slice(0, 15)
                                    .map(patient => {
                                        const latestVisit = patient.visits[patient.visits.length - 1];
                                        return (
                                            <div key={patient.regNumber} className={`patient-item ${latestVisit.completed ? 'completed' : ''}`}>
                                                <div className="patient-info">
                                                    <div className="patient-reg">{patient.regNumber}</div>
                                                    <div className="patient-date">
                                                        Latest: {formatDate(latestVisit.visitDate)} → Next: {formatDate(latestVisit.nextVisitDate)}
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '1rem',
                                                        marginTop: '0.5rem',
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        <span style={{color: 'var(--secondary)', fontWeight: 600}}>
                                                            📊 Last visit: {latestVisit.tabletDays} days
                                                        </span>
                                                        <span style={{color: 'var(--primary)', fontWeight: 600}}>
                                                            💊 Total: {patient.totalTabletDays} days
                                                        </span>
                                                        <span style={{color: 'var(--text-secondary)'}}>
                                                            🔢 {patient.visits.length} visits
                                                        </span>
                                                    </div>
                                                </div>
                                                <button 
                                                    className="btn btn-secondary btn-small"
                                                    onClick={() => openPatientHistory(patient.regNumber)}
                                                >
                                                    View History
                                                </button>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </>
                    )}
                </div>

                <div className="card" style={{marginBottom: '2rem'}}>
                    <h2 className="card-title">Calendar View</h2>
                    <div className="calendar-year-grid">
                        {MONTHS.map((month, index) => {
                            const uniquePatientCount = getUniquePatientsForMonth(index);
                            
                            return (
                                <div 
                                    key={month} 
                                    className="calendar-month-card"
                                    onClick={() => openMonthView(index)}
                                    style={{
                                        minHeight: 'auto',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        color: 'var(--primary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        marginBottom: '0.5rem'
                                    }}>
                                        {month.slice(0, 3)}
                                    </div>
                                    <div style={{
                                        fontSize: '2rem',
                                        fontWeight: 700,
                                        color: uniquePatientCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        lineHeight: 1
                                    }}>
                                        {uniquePatientCount}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {showMonthView && selectedMonth !== null && (
                <div className="modal-overlay" onClick={() => setShowMonthView(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '1200px'}}>
                        <div className="modal-header">
                            <div className="modal-title">
                                {MONTHS[selectedMonth]} 2026
                            </div>
                            <button className="modal-close" onClick={() => setShowMonthView(false)}>×</button>
                        </div>
                        
                        <div className="month-view-calendar">
                            {getMonthDatesDetailed(selectedMonth).map((dateInfo) => {
                                let dateClass = 'month-view-date';
                                if (dateInfo.isToday) dateClass += ' today';
                                if (dateInfo.isSunday) dateClass += ' sunday';
                                if (dateInfo.holiday) {
                                    if (dateInfo.holiday.type === 'poya') {
                                        dateClass += ' poya';
                                    } else {
                                        dateClass += ' holiday';
                                    }
                                }
                                
                                return (
                                    <div 
                                        key={dateInfo.day}
                                        className={dateClass}
                                        onClick={() => {
                                            if (dateInfo.count > 0) {
                                                openModalForDate(dateInfo.date);
                                            }
                                        }}
                                    >
                                        <div className="month-view-day-name">{dateInfo.dayName}</div>
                                        <div className="month-view-day-number">{dateInfo.day}</div>
                                        {dateInfo.count > 0 && (
                                            <div className="month-view-pt-count">{dateInfo.count} PT</div>
                                        )}
                                        {dateInfo.holiday && (
                                            <div className="month-view-holiday-name">{dateInfo.holiday.name}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {showYearView && (
                <div className="modal-overlay" onClick={() => setShowYearView(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '1200px'}}>
                        <div className="modal-header">
                            <div className="modal-title">
                                Full Year - {new Date().getFullYear()}
                            </div>
                            <button className="modal-close" onClick={() => setShowYearView(false)}>×</button>
                        </div>
                        
                        <h3 style={{marginBottom: '1rem', color: 'var(--primary)'}}>Unique Patients by Month</h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(6, 1fr)',
                            gap: '0.75rem',
                            marginTop: '1rem'
                        }}>
                            {MONTHS.map((month, index) => {
                                const count = getUniquePatientsForMonth(index);
                                return (
                                    <div 
                                        key={month}
                                        style={{
                                            background: 'var(--bg-main)',
                                            border: '2px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '1.25rem',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            fontSize: '1.1rem',
                                            fontWeight: 700,
                                            color: 'var(--primary)',
                                            marginBottom: '0.5rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                        }}>
                                            {month.slice(0, 3)}
                                        </div>
                                        <div style={{
                                            fontSize: '2rem',
                                            fontWeight: 700,
                                            color: 'var(--text-primary)'
                                        }}>
                                            {count}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{
                            marginTop: '2rem',
                            padding: '1rem',
                            background: 'var(--bg-main)',
                            borderRadius: '8px',
                            textAlign: 'center'
                        }}>
                            <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>
                                Total Unique Patients
                            </div>
                            <div style={{fontSize: '3rem', fontWeight: 700, color: 'var(--primary)'}}>
                                {uniquePatientCounts.total}
                            </div>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem'}}>
                                ({visits.length} total entries)
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showMonthCalendar && (
                <div className="modal-overlay" onClick={() => setShowMonthCalendar(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '900px'}}>
                        <div className="modal-header">
                            <div className="modal-title">
                                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                            <button className="modal-close" onClick={() => setShowMonthCalendar(false)}>×</button>
                        </div>
                        
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: '0.5rem',
                            marginTop: '1rem'
                        }}>
                            {Array.from({length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}, (_, i) => {
                                const date = new Date(new Date().getFullYear(), new Date().getMonth(), i + 1);
                                const count = getUniquePatientsForDate(date);
                                const isToday = date.toDateString() === new Date().toDateString();
                                
                                return (
                                    <div 
                                        key={i}
                                        onClick={() => openModalForDate(date)}
                                        style={{
                                            background: isToday ? 'var(--primary)' : 'var(--bg-main)',
                                            border: '2px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '1rem',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            color: isToday ? 'white' : 'inherit'
                                        }}
                                    >
                                        <div style={{fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem'}}>
                                            {i + 1}
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: isToday ? 'white' : 'var(--text-secondary)',
                                            opacity: isToday ? 0.9 : 1
                                        }}>
                                            {count} PT
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Patients - {modalDate}</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        
                        {modalPatients.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📋</div>
                                <p>No patients scheduled for this date</p>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    background: 'var(--bg-main)',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    marginBottom: '1rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    <strong>
                                        {new Set(modalPatients.filter(v => !v.completed).map(v => v.regNumber.trim().toUpperCase())).size}
                                    </strong> unique patients pending for this date
                                </div>
                                <div className="patient-list">
                                    {modalPatients.map(visit => (
                                        <div key={visit.id} className={`patient-item ${visit.completed ? 'completed' : ''}`}>
                                            <div className="patient-info">
                                                <div className="patient-reg">{visit.regNumber}</div>
                                                <div className="patient-date">
                                                    {visit.completed ? 'Completed ✓' : 'Pending'}
                                                </div>
                                            </div>
                                            <div className="patient-actions">
                                                <div className="checkbox-wrapper">
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox"
                                                        checked={visit.completed}
                                                        onChange={() => toggleCompleted(visit.id)}
                                                    />
                                                </div>
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
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '700px'}}>
                        <div className="modal-header">
                            <div className="modal-title">📊 Patient Tablet History</div>
                            <button className="modal-close" onClick={() => setShowPatientHistory(false)}>×</button>
                        </div>

                        <div style={{
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem'}}>
                                {selectedPatient.regNumber}
                            </div>
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem'}}>
                                <div>
                                    <div style={{fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem'}}>
                                        Total Tablets
                                    </div>
                                    <div style={{fontSize: '2.5rem', fontWeight: 700}}>
                                        {selectedPatient.totalTabletDays}
                                    </div>
                                    <div style={{fontSize: '0.75rem', opacity: 0.9}}>days</div>
                                </div>
                                <div>
                                    <div style={{fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem'}}>
                                        Total Visits
                                    </div>
                                    <div style={{fontSize: '2.5rem', fontWeight: 700}}>
                                        {selectedPatient.visits.length}
                                    </div>
                                    <div style={{fontSize: '0.75rem', opacity: 0.9}}>visits</div>
                                </div>
                            </div>
                        </div>

                        <h3 style={{marginBottom: '1rem', color: 'var(--primary)', fontSize: '1.1rem'}}>
                            Visit History
                        </h3>

                        <div className="patient-list" style={{maxHeight: '400px'}}>
                            {selectedPatient.visits.map((visit, index) => (
                                <div key={visit.id} style={{
                                    background: 'var(--bg-main)',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    marginBottom: '0.75rem',
                                    border: '2px solid var(--border)',
                                    borderLeft: '4px solid var(--secondary)'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '0.5rem'
                                    }}>
                                        <div>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-secondary)',
                                                marginBottom: '0.25rem'
                                            }}>
                                                Visit #{selectedPatient.visits.length - index}
                                            </div>
                                            <div style={{
                                                fontSize: '1rem',
                                                fontWeight: 600,
                                                color: 'var(--text-primary)'
                                            }}>
                                                {formatDate(visit.visitDate)}
                                            </div>
                                        </div>
                                        <div style={{
                                            background: 'var(--secondary)',
                                            color: 'white',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '6px',
                                            fontWeight: 700,
                                            fontSize: '1.1rem'
                                        }}>
                                            {visit.tabletDays} days
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        marginTop: '0.5rem'
                                    }}>
                                        <div>Next visit: {formatDate(visit.nextVisitDate)}</div>
                                        <div>Status: {visit.completed ? '✅ Completed' : '⏳ Pending'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{
                            marginTop: '1.5rem',
                            padding: '1rem',
                            background: '#e8f5e9',
                            borderRadius: '8px',
                            textAlign: 'center'
                        }}>
                            <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem'}}>
                                Treatment Duration
                            </div>
                            <div style={{fontSize: '1.2rem', fontWeight: 700, color: 'var(--secondary)'}}>
                                {formatDate(selectedPatient.firstVisitDate)} to {formatDate(selectedPatient.lastNextVisitDate)}
                            </div>
                            <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem'}}>
                                ({Math.ceil((new Date(selectedPatient.lastNextVisitDate) - new Date(selectedPatient.firstVisitDate)) / (1000 * 60 * 60 * 24))} days)
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

ReactDOM.render(<PTVisitTracker />, document.getElementById('root'));
