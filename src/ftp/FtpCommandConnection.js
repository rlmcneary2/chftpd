"use strict";


var log = require("../logging/logger");
const TcpConnection = require("../tcp/TcpConnection");


class FtpCommandConnection extends TcpConnection {

    constructor() {
        super();
        this._anonymous = true;
        this._username = null;
        this.binaryDataTransfer = true;
        this.currentDirectoryEntryId = null;
        this.dataConnection = null;
        this.lastCommand = null;
        this.loggedIn = false;
        this.sendEncoder = null;
        this.textDecoder = null;

        this._onReceiveHandler = function(info) {
            if (!this._socketId === info.socketId) {
                return;
            }

            var dataView = new DataView(info.data);
            var request = this.textDecoder.decode(dataView);
            log.info(`FtpCommandConnection.js _onReceiveHandler - client socket id ${info.socketId} request [${request.trim()}]`);

            const command = createCommandRequest(request);

            this.emit("receive", { clientSocketId: info.socketId, command });
        }.bind(this);
    }

    close() {
        this.dataConnection = null;
        this.lastCommand = null;
        this.loggedIn = false;
        this.sendEncoder = null;
        this.textDecoder = null;
        this._username = null;
        super.close();
    }

    /**
     * Send information to the client.
     * @param {string} message The information to send to the client.
     * @returns {Promise|object} A Promise that resolves to a result code after the data is sent. 
     */
    send(message) {
        let data = this.sendEncoder.encode(message);
        return super.send(data.buffer);
    }
    
    set anonymous(anonymous){
        this._anonymous = anonymous;
    }

    set username(username) {
        this._username = username;
    }

}


module.exports = FtpCommandConnection;


function createCommandRequest(request) {
    let commandSeparatorIndex = request.indexOf(" ");
    commandSeparatorIndex = 0 <= commandSeparatorIndex ? commandSeparatorIndex : request.indexOf("\r\n"); // Check for command with no arguments.
    const valid = 0 < commandSeparatorIndex;
    let result = {
        request,
        valid
    };

    if (valid) {
        result.argument = request.substring(commandSeparatorIndex + 1, request.length - 2); // Don't include the \r\n
        result.command = request.substring(0, commandSeparatorIndex).toUpperCase();
    }

    return result;
}
