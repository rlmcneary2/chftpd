"use strict";


const log = require("../logging/logger");
const TcpConnection = require("../tcp/TcpConnection");


/**
 * This is used to send data to a client using a passive connection.
 */
class FtpDataConnection extends TcpConnection {

    constructor() {
        super();
        this.sendEncoder = null;
        this.textDecoder = null;
    }

    send(message, binaryDataTransfer) {
        log.verbose(`FtpDataConnection.send - message [${message.trim()}]`);
        let encodedMessage = null;
        if (binaryDataTransfer) {
            encodedMessage = _sendEncoder.encode(message);
        } else {
            encodedMessage = new Int8Array(message.length);
            for (let i = 0; i < message.length; i++) {
                encodedMessage[i] = message.charCodeAt(i);
            }
        }

        return Promise.resolve(super.send(encodedMessage.buffer))
            .then(result => {
                log.verbose(`FtpDataConnection.js send() - result [${JSON.stringify(result)}].`);
            });
    }

}


module.exports = FtpDataConnection;


const _sendEncoder = new TextEncoder("utf8");
