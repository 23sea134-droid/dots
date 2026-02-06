const { useState, useEffect, useMemo, useCallback } = React;

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Sri Lankan Holidays and Poya Days for 2026
const SRI_LANKAN_HOLIDAYS_2026 = {
    0: [ // January
        { date: 1, name: "New Year's Day", type: "public" },
        { date: 13, name: "Duruthu Poya", type: "poya" },
        { date: 14, name: "Thai Pongal", type: "public" },
        { date: 15, name: "Duruthu Poya", type: "poya" }
    ],
    1: [ // February
        { date: 4, name: "Independence Day", type: "public" },
        { date: 11, name: "Navam Poya", type: "poya" },
        { date: 26, name: "Maha Sivarathri", type: "public" }
    ],
    2: [ // March
        { date: 13, name: "Medin Poya", type: "poya" },
        { date: 14, name: "Holi", type: "public" }
    ],
    3: [ // April
        { date: 2, name: "Idul Fitr", type: "public" },
        { date: 11, name: "Bak Poya", type: "poya" },
        { date: 13, name: "Sinhala & Tamil New Year Eve", type: "public" },
        { date: 14, name: "Sinhala & Tamil New Year", type: "public" },
        { date: 18, name: "Good Friday", type: "public" }
    ],
    4: [ // May
        { date: 1, name: "May Day", type: "public" },
        { date: 11, name: "Vesak Poya", type: "poya" },
        { date: 12, name: "Day after Vesak", type: "public" }
    ],
    5: [ // June
        { date: 9, name: "Poson Poya", type: "poya" },
        { date: 10, name: "Idul Alha", type: "public" }
    ],
    6: [ // July
        { date: 9, name: "Esala Poya", type: "poya" }
    ],
    7: [ // August
        { date: 7, name: "Nikini Poya", type: "poya" }
    ],
    8: [ // September
        { date: 6, name: "Binara Poya", type: "poya" },
        { date: 10, name: "Milad-un-Nabi", type: "public" }
    ],
    9: [ // October
        { date: 5, name: "Vap Poya", type: "poya" },
        { date: 21, name: "Deepavali", type: "public" }
    ],
    10: [ // November
        { date: 4, name: "Il Poya", type: "poya" }
    ],
    11: [ // December
        { date: 3, name: "Unduvap Poya", type: "poya" },
        { date: 25, name: "Christmas Day", type: "public" }
    ]
};
