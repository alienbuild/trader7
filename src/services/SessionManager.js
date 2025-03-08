class SessionManager {
    static sessions = {
        london: {
            start: "06:00",
            end: "15:00",
            timezone: "UTC"
        },
        newyork: {
            start: "12:00",
            end: "21:00",
            timezone: "UTC"
        },
        asia: {
            start: "22:00",
            end: "07:00",
            timezone: "UTC"
        }
    };

    static BRINKS_BOX_START = '14:00'; // GMT
    static BRINKS_BOX_END = '15:00';   // GMT

    static isActiveSession(session) {
        const currentTime = new Date();
        const sessionTimes = this.sessions[session];
        return this.isWithinSessionHours(currentTime, sessionTimes);
    }

    static getCurrentSessions() {
        const activeSessions = [];
        for (const [session, times] of Object.entries(this.sessions)) {
            if (this.isActiveSession(session)) {
                activeSessions.push(session);
            }
        }
        return activeSessions;
    }

    static getBrinksBoxTiming() {
        const londonOpen = this.sessions.london.start;
        return {
            formationStart: londonOpen,
            formationEnd: this.addHours(londonOpen, 1),
            validityEnd: this.addHours(londonOpen, 2)
        };
    }

    static async validateBrinksBoxSession() {
        const currentTime = new Date();
        const gmtHour = currentTime.getUTCHours();
        const gmtMinute = currentTime.getUTCMinutes();
        const currentTimeStr = `${gmtHour}:${gmtMinute}`;

        return {
            isValid: this.isWithinBrinksBox(currentTimeStr),
            timeRemaining: this.getTimeRemaining(currentTimeStr),
            isBoxComplete: this.isBoxComplete(currentTimeStr)
        };
    }

    static isWithinBrinksBox(currentTime) {
        return currentTime >= this.BRINKS_BOX_START && currentTime <= this.BRINKS_BOX_END;
    }

    static getTimeRemaining(currentTime) {
        // Calculate remaining time in Brinks Box
        // Return in minutes
    }

    static isWithinSessionHours(currentTime, sessionTimes) {
        const currentHour = currentTime.getUTCHours();
        const currentMinute = currentTime.getUTCMinutes();
        
        // Convert session times to minutes since midnight for easier comparison
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const sessionStartInMinutes = this.timeStringToMinutes(sessionTimes.start);
        const sessionEndInMinutes = this.timeStringToMinutes(sessionTimes.end);
        
        if (sessionStartInMinutes <= sessionEndInMinutes) {
            // Normal case: session starts and ends on the same day
            return currentTimeInMinutes >= sessionStartInMinutes && 
                   currentTimeInMinutes <= sessionEndInMinutes;
        } else {
            // Session spans midnight
            return currentTimeInMinutes >= sessionStartInMinutes || 
                   currentTimeInMinutes <= sessionEndInMinutes;
        }
    }

    static timeStringToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    static isBoxComplete(currentTimeStr) {
        const [currentHour, currentMinute] = currentTimeStr.split(':').map(Number);
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const boxEndInMinutes = this.timeStringToMinutes(this.BRINKS_BOX_END);
        
        return currentTimeInMinutes > boxEndInMinutes;
    }

    static addHours(timeStr, hoursToAdd) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        let newHours = (hours + hoursToAdd) % 24;
        return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    static async getCurrentSession(marketType) {
        if (marketType === 'CRYPTO') {
            return {
                canTrade: true,
                marketType: 'CRYPTO',
                currentSession: 'ALWAYS_OPEN'
            };
        }

        const now = new Date();
        const nyTime = this._convertToNewYorkTime(now);
        const sessionInfo = this._getNasdaqSessionInfo(nyTime);

        return {
            canTrade: sessionInfo.isTrading,
            marketType: 'NASDAQ',
            currentSession: sessionInfo.session,
            isTransitionPeriod: this._isTransitionPeriod(nyTime)
        };
    }

    static _convertToNewYorkTime(date) {
        return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    }

    static _getNasdaqSessionInfo(nyTime) {
        const hours = nyTime.getHours();
        const minutes = nyTime.getMinutes();
        const timeInMinutes = hours * 60 + minutes;

        // Define session boundaries
        const preMarketStart = 4 * 60;     // 04:00
        const regularStart = 9 * 60 + 30;  // 09:30
        const regularEnd = 16 * 60;        // 16:00
        const afterHoursEnd = 20 * 60;     // 20:00

        if (timeInMinutes < preMarketStart || timeInMinutes >= afterHoursEnd) {
            return { isTrading: false, session: 'CLOSED' };
        } else if (timeInMinutes < regularStart) {
            return { isTrading: true, session: 'PRE_MARKET' };
        } else if (timeInMinutes < regularEnd) {
            return { isTrading: true, session: 'REGULAR' };
        } else {
            return { isTrading: true, session: 'AFTER_HOURS' };
        }
    }

    static _isTransitionPeriod(nyTime) {
        const hours = nyTime.getHours();
        const minutes = nyTime.getMinutes();
        const timeInMinutes = hours * 60 + minutes;

        // Check for market open/close transition periods
        const marketOpenTransition = Math.abs(timeInMinutes - (9 * 60 + 30)) < 5;
        const marketCloseTransition = Math.abs(timeInMinutes - (16 * 60)) < 5;

        return marketOpenTransition || marketCloseTransition;
    }

    static isHoliday(date) {
        const holidays = {
            'New Years Day': { month: 0, day: 1 },
            'Martin Luther King Jr Day': { month: 0, week: 3, weekday: 1 },
            'Presidents Day': { month: 1, week: 3, weekday: 1 },
            'Good Friday': 'dynamic', // Needs special calculation
            'Memorial Day': { month: 4, lastWeek: true, weekday: 1 },
            'Independence Day': { month: 6, day: 4 },
            'Labor Day': { month: 8, week: 1, weekday: 1 },
            'Thanksgiving': { month: 10, week: 4, weekday: 4 },
            'Christmas': { month: 11, day: 25 }
        };

        return this._checkHoliday(date, holidays);
    }

    static isEarlyCloseDay(date) {
        const earlyCloseDays = {
            'Day Before Independence Day': { month: 6, day: 3 },
            'Day After Thanksgiving': { month: 10, week: 4, weekday: 5 },
            'Christmas Eve': { month: 11, day: 24 },
            'New Years Eve': { month: 11, day: 31 }
        };

        return this._checkHoliday(date, earlyCloseDays);
    }

    static _checkHoliday(date, holidayList) {
        const d = new Date(date);
        
        for (const [name, rules] of Object.entries(holidayList)) {
            if (rules === 'dynamic') continue; // Skip dynamic holidays

            if (rules.day) {
                if (d.getMonth() === rules.month && d.getDate() === rules.day) {
                    return name;
                }
            } else if (rules.week) {
                if (this._isNthWeekday(d, rules.month, rules.week, rules.weekday)) {
                    return name;
                }
            } else if (rules.lastWeek) {
                if (this._isLastWeekday(d, rules.month, rules.weekday)) {
                    return name;
                }
            }
        }

        return false;
    }

    static _isNthWeekday(date, month, n, weekday) {
        return date.getMonth() === month &&
               date.getDay() === weekday &&
               Math.ceil(date.getDate() / 7) === n;
    }

    static _isLastWeekday(date, month, weekday) {
        const lastDay = new Date(date.getFullYear(), month + 1, 0);
        let lastWeekday = lastDay.getDate();
        
        while (lastDay.getDay() !== weekday) {
            lastDay.setDate(--lastWeekday);
        }

        return date.getMonth() === month &&
               date.getDate() === lastWeekday;
    }

    static getNextTradingDay() {
        const date = new Date();
        do {
            date.setDate(date.getDate() + 1);
        } while (
            date.getDay() === 0 || // Sunday
            date.getDay() === 6 || // Saturday
            this.isHoliday(date)
        );
        return date;
    }
}

module.exports = SessionManager;