"use strict";


const log = require("../logging/logger");
const TcpServer = require("../tcp/TcpServer");


class FtpPassiveServer extends TcpServer {

    constructor() {
        super();
        this._closeEventHandler = closeHandler.bind(this);
        this._closeHandlerCallback = null;
        this._logName = "FtpPassiveServer";
        this._maxConnections = 1;
        this._receiveEventHandler = receiveHandler.bind(this);
        this._receiveErrorHandler = receiveErrorHandler.bind(this);
        this._receiveErrorHandlerCallback = null;
        this._receiveHandlerCallback = null;
        this._sendEncoder = null;
    }

    close() {
        this.removeListener("close", this._closeEventHandler);
        this.removeListener("receive", this._receiveErrorHandler);
        this.removeListener("receiveError", this._receiveErrorHandler);
        this._closeHandlerCallback = null;
        this._receiveEventHandler = null;
        this._receiveErrorHandler = null;
        this._receiveErrorHandlerCallback = null;
        this._receiveHandlerCallback = null;
        this._sendEncoder = null;
        super.close();
    }

    get clientSocketId() {
        return this.clientSockets.keys().next().value;
    }

    get closeHandlerCallback() {
        this._closeHandlerCallback;
    }

    get receiveBufferSize() {
        return 1024 * 100;
    }

    get receiveErrorHandlerCallback() {
        return this._receiveErrorHandlerCallback;
    }

    get receiveHandlerCallback() {
        return this._receiveHandlerCallback;
    }

    listen(address) {
        this.addListener("close", this._closeEventHandler);
        this.addListener("receive", this._receiveEventHandler);
        this.addListener("receiveError", this._receiveErrorHandler);
        return super.listen(address);
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

    set closeHandlerCallback(handler) {
        this._closeHandlerCallback = handler;
    }

    set receiveErrorHandlerCallback(handler) {
        this._receiveErrorHandlerCallback = handler;
    }

    set receiveHandlerCallback(handler) {
        this._receiveHandlerCallback = handler;
    }

    set sendEncoder(encoder) {
        this._sendEncoder = encoder;
    }

}


module.exports = FtpPassiveServer;


function closeHandler(evt) {
    if (this.closeHandlerCallback) {
        this.closeHandlerCallback(evt.data);
    }
}

function receiveHandler(evt) {
    if (this.receiveHandlerCallback) {
        this.receiveHandlerCallback(evt.data);
    }

    // if (this.receiveHandlerCallback) {
    //     let data = evt.data;
    //     chrome.sockets.tcp.getInfo(this.clientSocketId, info => {
    //         let err = chrome.runtime.lastError;
    //         log.verbose(`${this._logName}[${this._instanceCount}].receiveHandler - socket alive? info: ${JSON.stringify(info)}, err: ${JSON.stringify(err)}`);
    //         this.receiveHandlerCallback(data);
    //     });
    // }
}

function receiveErrorHandler(evt) {
    if (this.receiveErrorHandlerCallback) {
        this.receiveErrorHandlerCallback(evt.data);
    }
}
