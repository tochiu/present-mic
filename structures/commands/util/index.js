function formatSeconds(seconds) {
    return `${Math.floor(seconds/60)}:${Math.round(seconds % 60).toString().padStart(2, "0")}`
}

module.exports = {
    formatSeconds
}