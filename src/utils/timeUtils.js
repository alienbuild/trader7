const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getMarketSessionTime(sessionName, timeZone) {
    const session = await prisma.marketSession.findFirst({
        where: { sessionName }
    });

    if (!session) {
        throw new Error(`Market session "${sessionName}" not found.`);
    }

    const localTime = new Date(session.openTime * 1000).toLocaleString("en-US", { timeZone });
    return {
        sessionName,
        localTime,
        utcTime: session.openTime,
        isActive: isSessionActive(session),
        nextSession: await getNextSession(sessionName)
    };
}

function isSessionActive(session) {
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime >= session.openTime && currentTime < session.closeTime;
}

async function getNextSession(currentSession) {
    const sessions = await prisma.marketSession.findMany({
        orderBy: { openTime: 'asc' }
    });
    
    const currentIndex = sessions.findIndex(s => s.sessionName === currentSession);
    const nextIndex = (currentIndex + 1) % sessions.length;
    
    return sessions[nextIndex];
}

module.exports = {
    getMarketSessionTime
};