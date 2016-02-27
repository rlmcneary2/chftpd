"use strict";


var EventEmitter = require("eventemitter3");
var log = require("../logging/logger");
var TcpConnection = require("./TcpConnection");


class TcpServer extends EventEmitter {

    constructor() {
        super();
        this._connections = new Map();
        this._address = null;
        this._port = 0;
        this._socketId = -1;

        this._acceptHandler = function(info) {
            //log.verbose(`TcpServer._acceptHandler - server socket: ${this._socketId}, acceptInfo: ${JSON.stringify(info)}.`);
            if (this._socketId !== info.socketId) {
                return;
            }

            const self = this;
            return tcpGetSocketInfo(info.clientSocketId)
                .then(clientSocketInfo => {
                    log.info(`Accepted connection on client socket ${info.clientSocketId} from: ${JSON.stringify(clientSocketInfo)}.`);
                    return Promise.resolve(self.createConnection(clientSocketInfo));
                })
                .then(tc => {
                    self._connections.set(info.clientSocketId, tc);
                    return tc.listen(info.clientSocketId);
                })
                .then(tc => {
                    self.emit("accept", { clientSocketId: tc.socketId });
                });
        }.bind(this);
    }

    close() {
        const self = this;
        return tcpClose.call(this)
            .then(() => {
                self._connections.clear();
                return self;
            });
    }

    createConnection() {
        return new TcpConnection();
    }

    get address() {
        return this._address;
    }

    get port() {
        return this._port;
    }

    set port(port) {
        this._port = port;
    }

    get socketId() {
        return this._socketId;
    }

    getConnection(clientSocketId) {
        if (!this._connections.has(clientSocketId)) {
            return null;
        }

        return this._connections.get(clientSocketId);
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
        this._address = address;
        const self = this;
        return tcpCreate()
            .then(socketId => {
                self._socketId = socketId;
                chrome.sockets.tcpServer.onAccept.addListener(self._acceptHandler);
                return tcpListen(self._socketId, self._address, self._port);
            })
            .then(() => {
                return tcpGetSocketInfo(self._socketId);
            })
            .then(socketInfo => {
                self._port = socketInfo.localPort;
                return new Promise(resolve => {
                    chrome.sockets.tcpServer.setPaused(self._socketId, false, () => {
                        log.info(`TcpServer.listen - server socket ${self._socketId} on port ${self._port} accepting connections.`);
                        resolve();
                    });
                });
            });
    }
}


module.exports = TcpServer;


function disconnectSocketHandlers() {
    let promises = this._connections.forEach(val => {
        return val.close();
    }, this);

    return Promise.all(promises);
}

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

function tcpClose() {
    var self = this;
    return new Promise((resolve) => {
        log.verbose(`TcpServer.js tcpClose() - removing listeners for socket ${self._socketId}.`);
        chrome.sockets.tcpServer.onAccept.removeListener(self._acceptHandler);
        disconnectSocketHandlers.call(self)
            .then(() => {
                chrome.sockets.tcpServer.close(self._socketId, () => {
                    log.verbose(`TcpServer.js tcpClose() - socket ${self._socketId} closed.`);
                    resolve();
                });
            });
    });
}

// function tcpSocketClose(clientSocketId) {
//     return new Promise((resolve) => {
//         chrome.sockets.tcp.close(clientSocketId, () => {
//             log.verbose(`TcpServer.js tcpSocketClose() - socket ${clientSocketId} closed.`);
//             resolve();
//         });
//     });
// }

// function tcpCreateAndListen(address, port) {
//     var self = this;
//     return new Promise(function(resolve, reject) {
//         tcpCreate()
//             .then(function(socketId) {
//                 self._socketId = socketId;
//                 tcpListen.call(self, socketId, address, port)
//                     .then(function() {
//                         resolve();
//                     });
//             });
//     });
// }

function tcpCreate() {
    return new Promise(resolve => {
        chrome.sockets.tcpServer.create({ name: "chftpd" }, function(createInfo) {
            log.verbose(`TcpServer.js tcpCreate - socketId ${createInfo.socketId}.`);
            resolve(createInfo.socketId);
        });
    });
}

function tcpGetSocketInfo(socketId) {
    return new Promise(function(resolve, reject) {
        chrome.sockets.tcpServer.getInfo(socketId, function(socketInfo) {
            let lastErr = chrome.runtime.lastError;
            //log.verbose(`TcpServer.js tcpGetSocketInfo() - socketInfo: ${JSON.stringify(socketInfo)}.`);
            resolve(socketInfo);
        });
    });
}

function tcpListen(socketId, address, port) {
    //    var self = this;
    return new Promise(function(resolve) {
        log.verbose(`TcpServer.js tcpListen - address: ${address}, port: ${port}.`);
        chrome.sockets.tcpServer.listen(socketId, address, port, () => {
            //            chrome.sockets.tcpServer.onAccept.addListener(self._acceptHandler);
            resolve();
        });
    });
}

// function tcpListenHandler(result, socketId, port) {
//     if (result < 0) {
//         throw `TcpServer.js tcpListenHandler() - listen error result: ${result}.`;
//     }

//     var self = this;
//     return Promise.resolve()
//         .then(function() {
//             if (port === 0) {
//                 return tcpGetSocketInfo(socketId)
//                     .then(function(socketInfo) {
//                         self.port = socketInfo.localPort;
//                         return;
//                     });
//             }
//             else {
//                 return Promise.resolve();
//             }
//         })
//         .then(function() {
//             chrome.sockets.tcpServer.onAccept.addListener(self._acceptHandler);
//             return;
//         });
// }
