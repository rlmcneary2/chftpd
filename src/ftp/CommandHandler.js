"use strict";


class CommandHandler {

    /**
     * Handle a command request.
     * @param {FtpServer} server The FtpServer instance that received the request.
     * @param {object} state An object where state information can be stored for requests from this client and session.
     * @param {string} request The raw request string.
     * @param {function} sendHandler A callback that can be used to send a response to this request. The callback takes one argument which is a fully formatted FTP response string including terminating characters "\r\n". The callback returns a Promise that resolves when the message has been sent.
     * @returns {Promise|object} result - An object with information about how the request was handled.
     * @returns {string} result.error - Contains a description of the error that happened. 
     */
    handleRequest(server, state, request, sendHandler) {
        var command = createCommandRequest(request);
        return Promise.resolve()
            .then(() => {
                if (!command.valid) {
                    console.log(`CommandHandler.js handleRequest() - "${command.command}" is not valid.`);
            
                    // TODO send error response to client.

                    return {
                        command,
                        error: `"${command.command}" is not valid.`
                    };
                }

                var handlerName = command.command.toLowerCase();
                if (!_supportedCommands.hasOwnProperty(handlerName)) {
                    console.log(`CommandHandler.js handleRequest() - "${command.command}" is not supported.`);

                    // TODO send error response to client.

                    return {
                        command,
                        error: `"${command.command}" is not supported.`
                    };
                }

                return Promise.resolve(_supportedCommands[handlerName](server, state, command, sendHandler))
            })
            .then(error => {
                var result = {
                    command
                };

                if (typeof error === "string") {
                    result.error = error;
                }

                return result;
            });
    }

}


var _supportedCommands = {

    user(server, state, command, sendHandler) {
        console.log(`CommandHandler.js user() - "${command.command}".`);
        if (typeof state.lastCommand !== "undefined" || state.lastCommand !== null) {
            // TODO: It's an error if USER is not the first command received.
        }

        if (typeof state.user !== "undefined") {
            // TODO: It's an error if USER has already been sent.
        }
        
        state.user = command.argument;
        return Promise.resolve(sendHandler(`331 anonymous login ${server.getAllowAnonymousLogin() ? "is" : "is not"} allowed.\r\n`))
            .then(() => { return; });
    },

    pass(server, state, command, sendHandler) {
        console.log(`CommandHandler.js pass() - "${command.command}".`);
    }
}


function createCommandRequest(request) {
    var commandSeparatorIndex = request.indexOf(" ");
    var valid = 0 < commandSeparatorIndex;
    var result = {
        request,
        valid
    };

    if (valid) {
        result.argument = request.substring(commandSeparatorIndex + 1, request.length - 2); // Don't include the \r\n
        result.command = request.substring(0, commandSeparatorIndex);
    }

    return result;
}


module.exports = CommandHandler;
