"use strict";


const EventEmitter = require("eventemitter3");
const log = require("../logging/logger");
const tcpAsync = require("./tcpAsync");


let iCount = 1;


class TcpServer extends EventEmitter {

    constructor() {
        super();
        this._acceptHandler = null;
        this._address = null;
        this._clientSockets = new Map();
        this._instanceCount = (iCount++);
        this._logName = "TcpServer";
        this._maxConnections = 0;
        this._port = 0;
        this._receiveErrorHandler = null;
        this._receiveHandler = null;
        this._socketId = -1;
    }

    close() {
        let closePromises = [];
        this._clientSockets.forEach((v, k) => {
            log.verbose(`${this._logName}[${this._instanceCount}].close - closing client socket ${k}.`);
            closePromises.push(tcpAsync.tcpClose(k));
        });

        this._clientSockets.clear();
        chrome.sockets.tcpServer.onAccept.removeListener(this.acceptHandler);
        chrome.sockets.tcp.onReceive.removeListener(this.eceiveHandler);
        chrome.sockets.tcp.onReceiveError.removeListener(this.receiveErrorHandler);

        const self = this;
        return Promise.all(closePromises)
            .then(() => {
                return tcpAsync.tcpServerClose.call(this, this.socketId);
            })
            .then(() => {
                log.verbose(`${this._logName}[${this._instanceCount}].close - server socket ${self.socketId} closed.`);
                return self;
            });
    }

    get acceptHandler() {
        if (this._acceptHandler === null) {
            this._acceptHandler = function(info) {
                if (this.socketId !== info.socketId) {
                    return;
                }

                if (0 < this._maxConnections && this._maxConnections <= this.clientSockets.size) {
                    log.warning(`${this._logName}[${this._instanceCount}].acceptHandler - already accepted the maximum number of connections.`);
                    tcpAsync.tcpClose(info.clientSocketId);
                    return;
                }

                log.info(`${this._logName}[${this._instanceCount}].acceptHandler - accepted connection from client socket ${info.clientSocketId}.`);
                this.clientSockets.set(info.clientSocketId, { connected: Date.now(), socketId: info.clientSocketId });

                // chrome.sockets.tcp.setPaused(info.clientSocketId, false, () => {
                //     log.verbose(`${this._logName}[${this._instanceCount}].acceptHandler - client socket ${info.clientSocketId} un-paused.`);
                //     this.emit("accept", { clientSocketId: info.clientSocketId });
                // });




                chrome.sockets.tcp.update(info.clientSocketId, { bufferSize: 1028 }, () => {
                    chrome.sockets.tcp.setPaused(info.clientSocketId, false, () => {
                        log.verbose(`${this._logName}[${this._instanceCount}].acceptHandler - client socket ${info.clientSocketId} un-paused.`);
                        this.emit("accept", { clientSocketId: info.clientSocketId });
                    });
                });







            }.bind(this);
        }

        return this._acceptHandler;
    }

    get address() {
        return this._address;
    }

    get clientSockets() {
        return this._clientSockets;
    }

    get port() {
        return this._port;
    }

    get receiveBufferSize() {
        return;
    }

    get receiveErrorHandler() {
        if (this._receiveErrorHandler === null) {
            this._receiveErrorHandler = function(info) {
                if (!this.clientSockets.has(info.socketId)) {
                    return;
                }

                log.info(`${this._logName}[${this._instanceCount}].receiveErrorHandler - server socket ${this.socketId} received error ${info.resultCode} from client socket ${info.socketId}.`);

                if (info.resultCode === -100) {
                    // The client closed the socket. Raise the socket closed event.
                    this.emit("close", { clientSocketId: info.socketId });
                } else {
                    this.emit("receiveError", { clientSocketId: info.socketId, data: info.data });
                }
            }.bind(this);
        }

        return this._receiveErrorHandler;
    }

    get receiveHandler() {
        if (this._receiveHandler === null) {
            this._receiveHandler = function(info) {
                if (!this.clientSockets.has(info.socketId)) {
                    return;
                }

                log.info(`${this._logName}[${this._instanceCount}].receiveHandler - server socket ${this.socketId} received from client socket ${info.socketId}.`);
                this.emit("receive", { clientSocketId: info.socketId, data: info.data });
            }.bind(this);
        }

        return this._receiveHandler;
    }

    get socketId() {
        return this._socketId;
    }

    getNetworkInterfaces() {
        return getIPv4NetworkInterfaces();
    }

    /**
     * Start listening for connections from clients.
     * @param {string} address The network interface address to bind to.
     * @returns {Promise|object} A Promise that resolves to an object with socket information.
     */
    listen(address) {
        log.info(`${this._logName}[${this._instanceCount}].listen - address: ${address}.`);
        this._address = address;
        const self = this;
        return tcpAsync.tcpCreate(self.receiveBufferSize)
            .then(socketId => {
                self._socketId = socketId;
                chrome.sockets.tcpServer.onAccept.addListener(self.acceptHandler);
                chrome.sockets.tcp.onReceive.addListener(self.receiveHandler);
                chrome.sockets.tcp.onReceiveError.addListener(self.receiveErrorHandler);
                return tcpAsync.tcpListen(self.socketId, self._address, self._port);
            })
            .then(() => {
                return tcpAsync.tcpGetSocketInfo(self.socketId);
            })
            .then(socketInfo => {
                self._port = socketInfo.localPort;
                return new Promise(resolve => {
                    chrome.sockets.tcpServer.setPaused(self.socketId, false, () => {
                        log.info(`${self._logName}[${self._instanceCount}].listen - server socket ${self.socketId} on port ${self._port} accepting connections.`);
                        resolve();
                    });
                });
            });
    }

    // pauseReceive(clientSocketId, pause, callback) {
    //     chrome.sockets.tcp.setPaused(clientSocketId, pause, () => {
    //         log.verbose(`${this._logName}[${this._instanceCount}].pauseReceive - client socket ${clientSocketId} ${pause ? "paused" : "un-paused"}.`);
    //         if (callback){
    //             callback();
    //         }
    //     });
    // }

    /**
     * Send data from the server to the client.
     * @param {number} clientSocketId Send data on this scoket.
     * @param {ArrayBuffer|function} data To send a single block of data use an ArrayBuffer. To stream data (like large files) this should be a callback function with no arguments. The callback returns a promise that resolves to an ArrayBuffer.
     */
    send(clientSocketId, data) {
        if (typeof data === "function") {
            return sendAllData(clientSocketId, data);
        } else {
            const self = this;
            return new Promise(function(resolve, reject) {
                log.verbose(`${self._logName}[${self._instanceCount}].send - client socket ${clientSocketId} sent.`);
                chrome.sockets.tcp.send(clientSocketId, data, sendInfo => {
                    if (sendInfo.resultCode < 0) {
                        reject(sendInfo);
                        return;
                    }

                    resolve(sendInfo);
                });
            });
        }
    }

    set port(port) {
        this._port = port;
    }

}


module.exports = TcpServer;


function getIPv4NetworkInterfaces() {
    return new Promise(function(resolve, reject) {
        chrome.system.network.getNetworkInterfaces(function(networkInterfaces) {
            var err = chrome.runtime.lastError;
            if (err) {
                reject(err);
            }

            if (typeof networkInterfaces === "undefined" || networkInterfaces === null) {
                resolve([]);
            }

            var interfaces = [];
            for (var i = 0; i < networkInterfaces.length; i++) {
                // This test is probably guaranteed to fail someday. If there is no ':' then it is not an IPv6 address.
                if (networkInterfaces[i].address.indexOf(":") < 0) {
                    interfaces.push(networkInterfaces[i]);
                }
            }

            resolve(interfaces);
        });
    });
}

function sendAllData(clientSocketId, getDataCallback) {
    return Promise.resolve(getDataCallback())
        .then(data => {
            if (data === null) {
                return;
            }

            return sendData(clientSocketId, data)
                .then(() => {
                    return sendAllData(clientSocketId, getDataCallback);
                });
        });
}

function sendData(clientSocketId, data) {
    return new Promise((resolve, reject) => {
        chrome.sockets.tcp.send(clientSocketId, data, sendInfo => {
            if (sendInfo.resultCode < 0) {
                reject(sendInfo);
                return;
            }

            resolve(sendInfo);
        });
    });
}
