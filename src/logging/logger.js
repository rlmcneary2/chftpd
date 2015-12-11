

module.exports = {

    /**
     * Pass a template string containing an informational message.
     */
    info() {
        var parts = arguments[0];
        var message = parts[0];
        for (var i = 1; i < arguments.length; ++i) {
            message += arguments[i] + parts[i - 1];
        }

        console.log(message);
    }
};
