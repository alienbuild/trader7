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
}

module.exports = SessionManager;