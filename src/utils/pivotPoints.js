async function getPivotPoints(symbol) {
    return await prisma.pivotPoints.findFirst({
        where: { symbol },
        orderBy: { date: "desc" }
    });
}

module.exports = { getPivotPoints };