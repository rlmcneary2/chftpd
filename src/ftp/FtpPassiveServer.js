"use strict";


const log = require("../logging/logger");
const TcpServer = require("../tcp/TcpServer");


class FtpPassiveServer extends TcpServer {

    constructor() {
        super();
        this._logName = "FtpPassiveServer";
        this._maxConnections = 1;
        this._sendEncoder = null;
    }

    close() {
        this._sendEncoder = null;
        super.close();
    }

    get clientSocketId() {
        return this.clientSockets.keys().next().value;
    }

    send(clientSocketId, message, binaryDataTransfer) {
        if (typeof message === "function") {
            return super.send(clientSocketId, message);
        } else {
            log.verbose(`${this._logName}[${this._instanceCount}].send - message [${message.trim()}]`);
            let encodedMessage = null;
            if (binaryDataTransfer) {
                encodedMessage = this._sendEncoder.encode(message);
            } else {
                encodedMessage = new Int8Array(message.length);
                for (let i = 0; i < message.length; i++) {
                    encodedMessage[i] = message.charCodeAt(i);
                }
            }

            return Promise.resolve(super.send(clientSocketId, encodedMessage.buffer))
                .then(result => {
                    log.verbose(`${this._logName}[${this._instanceCount}].send - result [${JSON.stringify(result)}].`);
                });
        }
    }

    set sendEncoder(encoder) {
        this._sendEncoder = encoder;
    }

}


module.exports = FtpPassiveServer;
