class PerformanceError extends Error {
    /**
     * reqpresents an error caused by a procedure taking too long to complete
     * @param {String} message - error message
     */
    constructor (message) {
        super(message);
        this.name = "PerformanceError";
    }
}

exports.PerformanceError = PerformanceError;
