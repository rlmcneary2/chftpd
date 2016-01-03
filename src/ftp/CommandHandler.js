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
                    console.log(`CommandHandler.js handleRequest() - "${command.command}" is not implemented.`);

                    // Send not implemented error response to client.
                    return Promise.resolve(sendHandler("502 Command not implemented.\r\n"))
                        .then(() => { return `"${command.command}" is not implemented.`; });
                }

                return Promise.resolve(_supportedCommands[handlerName](server, state, command, sendHandler));
            })
            .then(error => {
                var result = {
                    command
                };

                if (typeof error !== "undefined" && error !== null) {
                    result.error = error;
                } else {
                    state.lastCommand = command.command;
                }

                return result;
            });
    }

}


var _supportedCommands = {

    user(server, state, command, sendHandler) {
        console.log(`CommandHandler.js user() - "${command.command}".`);

        var response = null;
        if (typeof state.lastCommand !== "undefined" && state.lastCommand !== null) {
            // It's an error if USER is not the first command received.
            response = "503 USER required first.\r\n";
        }

        if (typeof state.user !== "undefined") {
            // It's an error if USER has already been sent.
            response = "503 already set.\r\n";
        }

        // Always allow login to proceed from user. If the username and / or password are incorrect an error is returned in pass().
        if (response === null) {
            var allowAnonymous = server.getAllowAnonymousLogin();
            response = `331 Anonymous login ${allowAnonymous ? "is" : "is not"} allowed.\r\n`;
            state.user = allowAnonymous ? server.getUsername() : command.argument;
        }
        
        return Promise.resolve(sendHandler(response))
            .then(() => { return; });
    },

    pass(server, state, command, sendHandler) {
        console.log(`CommandHandler.js pass() - "${command.command}".`);

        var response = "230 User logged in, proceed.\r\n";
        if (state.lastCommand !== "USER") {
            // It's an error if USER is not the previous command received.
            response = "503 USER required first.\r\n";
        }
        else {
            if (!server.getAllowAnonymousLogin()) {
                if (state.user !== server.getUsername() || command.argument !== server.getPassword()) {
                    delete state.user;
                    response = "530 Username and/or password is incorrect.\r\n";
                } else {
                    state.loggedIn = true;
                }
            } else {
                state.anonymous = command.argument;
                state.loggedIn = true;
            }
        }

        return Promise.resolve(sendHandler(response))
            .then(() => { return; });
    }
}


function createCommandRequest(request) {
    var commandSeparatorIndex = request.indexOf(" ");
    commandSeparatorIndex = 0 <= commandSeparatorIndex ? commandSeparatorIndex : request.indexOf("\r\n"); // Check for command with no arguments.
    var valid = 0 < commandSeparatorIndex;
    var result = {
        request,
        valid
    };

    if (valid) {
        result.argument = request.substring(commandSeparatorIndex + 1, request.length - 2); // Don't include the \r\n
        result.command = request.substring(0, commandSeparatorIndex).toUpperCase();
    }

    return result;
}


module.exports = CommandHandler;
