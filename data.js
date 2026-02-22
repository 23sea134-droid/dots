// ============================================================
// PT TABLET FOLLOW-UP — Holiday & Calendar Data
// Sri Lankan Public Holidays + Poya Days (Official Government Data)
// ============================================================

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Official Sri Lankan Holidays — sourced from Government Gazette & CalendarLabs
// To update: replace the year object with new official data each December
const SRI_LANKAN_HOLIDAYS = {
    2025: {
        0: [
            { date: 13, name: "Duruthu Poya", type: "poya" },
            { date: 14, name: "Tamil Thai Pongal", type: "public" },
            { date: 15, name: "Duruthu Poya (Observed)", type: "poya" }
        ],
        1: [
            { date: 4, name: "Independence Day", type: "public" },
            { date: 12, name: "Navam Poya", type: "poya" },
            { date: 26, name: "Maha Sivarathri", type: "public" }
        ],
        2: [
            { date: 13, name: "Medin Poya", type: "poya" },
            { date: 14, name: "Medin Poya (Observed)", type: "poya" },
            { date: 30, name: "Id-Ul-Fitr", type: "public" }
        ],
        3: [
            { date: 12, name: "Bak Poya", type: "poya" },
            { date: 13, name: "Sinhala & Tamil New Year Eve", type: "public" },
            { date: 14, name: "Sinhala & Tamil New Year", type: "public" },
            { date: 18, name: "Good Friday", type: "public" }
        ],
        4: [
            { date: 1, name: "May Day", type: "public" },
            { date: 12, name: "Vesak Poya", type: "poya" },
            { date: 13, name: "Day after Vesak", type: "public" }
        ],
        5: [
            { date: 6, name: "Id-Ul-Alha", type: "public" },
            { date: 10, name: "Poson Poya", type: "poya" }
        ],
        6: [
            { date: 10, name: "Esala Poya", type: "poya" }
        ],
        7: [
            { date: 8, name: "Nikini Poya", type: "poya" }
        ],
        8: [
            { date: 5, name: "Milad-Un-Nabi", type: "public" },
            { date: 7, name: "Binara Poya", type: "poya" }
        ],
        9: [
            { date: 6, name: "Vap Poya", type: "poya" },
            { date: 20, name: "Deepavali", type: "public" }
        ],
        10: [
            { date: 5, name: "Il Poya", type: "poya" }
        ],
        11: [
            { date: 4, name: "Unduvap Poya", type: "poya" },
            { date: 25, name: "Christmas Day", type: "public" }
        ]
    },
    2026: {
        0: [ // January
            { date: 1, name: "New Year's Day", type: "public" },
            { date: 3, name: "Duruthu Poya", type: "poya" },
            { date: 15, name: "Tamil Thai Pongal", type: "public" }
        ],
        1: [ // February
            { date: 1, name: "Nawam Poya", type: "poya" },
            { date: 4, name: "Independence Day", type: "public" },
            { date: 15, name: "Maha Sivarathri", type: "public" }
        ],
        2: [ // March
            { date: 2, name: "Medin Poya", type: "poya" },
            { date: 21, name: "Id-Ul-Fitr", type: "public" }
        ],
        3: [ // April
            { date: 1, name: "Bak Poya", type: "poya" },
            { date: 3, name: "Good Friday", type: "public" },
            { date: 13, name: "Sinhala & Tamil New Year Eve", type: "public" },
            { date: 14, name: "Sinhala & Tamil New Year", type: "public" }
        ],
        4: [ // May
            { date: 1, name: "May Day / Vesak Poya", type: "poya" },
            { date: 2, name: "Day after Vesak", type: "public" },
            { date: 28, name: "Id-Ul-Alha", type: "public" },
            { date: 30, name: "Adhi-Vap Poya", type: "poya" }
        ],
        5: [ // June
            { date: 29, name: "Poson Poya", type: "poya" }
        ],
        6: [ // July
            { date: 29, name: "Esala Poya", type: "poya" }
        ],
        7: [ // August
            { date: 26, name: "Milad-Un-Nabi", type: "public" },
            { date: 27, name: "Nikini Poya", type: "poya" }
        ],
        8: [ // September
            { date: 26, name: "Binara Poya", type: "poya" }
        ],
        9: [ // October
            { date: 25, name: "Vap Poya", type: "poya" }
        ],
        10: [ // November
            { date: 8, name: "Deepavali", type: "public" },
            { date: 24, name: "Il Poya", type: "poya" }
        ],
        11: [ // December
            { date: 23, name: "Unduvap Poya", type: "poya" },
            { date: 25, name: "Christmas Day", type: "public" }
        ]
    },
    2027: {
        0: [
            { date: 1, name: "New Year's Day", type: "public" },
            { date: 22, name: "Duruthu Poya", type: "poya" }
        ],
        1: [
            { date: 4, name: "Independence Day", type: "public" },
            { date: 20, name: "Nawam Poya", type: "poya" }
        ],
        2: [
            { date: 5, name: "Maha Sivarathri", type: "public" },
            { date: 11, name: "Id-Ul-Fitr", type: "public" },
            { date: 22, name: "Medin Poya", type: "poya" },
            { date: 26, name: "Good Friday", type: "public" }
        ],
        3: [
            { date: 13, name: "Sinhala & Tamil New Year Eve", type: "public" },
            { date: 14, name: "Sinhala & Tamil New Year", type: "public" },
            { date: 20, name: "Bak Poya", type: "poya" }
        ],
        4: [
            { date: 1, name: "May Day", type: "public" },
            { date: 17, name: "Id-Ul-Alha", type: "public" },
            { date: 20, name: "Vesak Poya", type: "poya" },
            { date: 21, name: "Day after Vesak", type: "public" }
        ],
        5: [
            { date: 18, name: "Poson Poya", type: "poya" }
        ],
        6: [
            { date: 18, name: "Esala Poya", type: "poya" }
        ],
        7: [
            { date: 16, name: "Milad-Un-Nabi", type: "public" },
            { date: 16, name: "Nikini Poya", type: "poya" }
        ],
        8: [
            { date: 15, name: "Binara Poya", type: "poya" }
        ],
        9: [
            { date: 14, name: "Vap Poya", type: "poya" },
            { date: 28, name: "Deepavali", type: "public" }
        ],
        10: [
            { date: 13, name: "Il Poya", type: "poya" }
        ],
        11: [
            { date: 12, name: "Unduvap Poya", type: "poya" },
            { date: 25, name: "Christmas Day", type: "public" }
        ]
    }
};

// Helper: Get holidays for a given year and month
function getHolidaysForMonth(year, monthIndex) {
    const yearData = SRI_LANKAN_HOLIDAYS[year];
    if (!yearData) return [];
    return yearData[monthIndex] || [];
}

// Helper: Get holiday for a specific date
function getHolidayForDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const holidays = getHolidaysForMonth(year, month);
    return holidays.find(h => h.date === day) || null;
}

// Helper: Check if holiday data exists for a year
function hasHolidayData(year) {
    return !!SRI_LANKAN_HOLIDAYS[year];
}
