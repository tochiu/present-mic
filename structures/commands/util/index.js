/* convert to seconds to mm:ss */
function formatSeconds(seconds) {
    return `${Math.floor(seconds / 60)}:${Math.round(seconds % 60).toString().padStart(2, "0")}`
}

/* parse 1-indexed ranges */
function parseRanges(str) {
    return str
        .split(",")
        .map(rangeStr => rangeStr
            .split("-")
            .map(num => parseInt(num))
            .filter(num => !isNaN(num) && num > 0)
        )
        .map(range => {
            const a = range[0]
            const b = range[range.length - 1]

            if (a && b) {
                return [Math.min(a, b) - 1, Math.max(a, b) - (Math.min(a, b) - 1)]
            }
        })
        .filter(splice => splice)
}

module.exports = { formatSeconds, parseRanges }