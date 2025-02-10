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
    return `Session: ${sessionName}, Local Time: ${localTime}`;
}

module.exports = { getMarketSessionTime };
