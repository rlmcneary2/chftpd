"use strict";


const log = require("../logging/logger");
const TcpServer = require("../tcp/TcpServer");


class FtpPassiveServer extends TcpServer {

    constructor() {
        super();
        this._logName = "FtpPassiveServer";
        this._maxConnections = 1;
        this._receiveEventHandler = receiveHandler.bind(this);
        this._receiveHandlerCallback;
        this._sendEncoder = null;
    }

    close() {
        this.removeListener("receive", this._receiveEventHandler);
        this._receiveEventHandler = null;
        this._receiveHandlerCallback = null;
        this._sendEncoder = null;
        super.close();
    }

    get clientSocketId() {
        return this.clientSockets.keys().next().value;
    }

    get receiveBufferSize() {
        return 1024 * 100;
    }
    
    get receiveHandlerCallback(){
        return this._receiveHandlerCallback;
    }

    listen(address) {
        this.addListener("receive", this._receiveEventHandler);
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

    set receiveHandlerCallback(handler) {
        this._receiveHandlerCallback = handler;
    }

    set sendEncoder(encoder) {
        this._sendEncoder = encoder;
    }

}


module.exports = FtpPassiveServer;


function receiveHandler(evt) {
    if (this.receiveHandlerCallback){
        this.receiveHandlerCallback (evt.data);
    }
}
