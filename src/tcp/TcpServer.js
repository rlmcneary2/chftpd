"use strict";


var EventEmitter = require("eventemitter3");
var log = require("../logging/logger");
const tcpAsync = require("./tcpAsync");
var TcpConnection = require("./TcpConnection");


class TcpServer extends EventEmitter {

    constructor() {
        super();
        this._acceptHandler = null;
        this._connections = new Map();
        this._address = null;
        this._port = 0;
        this._socketId = -1;
    }

    close() {
        const self = this;
        return disconnectSocketHandlers.call(self)
            .then(() => {
                self._connections.clear();
            })
            .then(() => {
                return tcpAsync.tcpServerClose.call(this, this._socketId, this.acceptHandler);
            })
            .then(() => {
                log.verbose(`TcpServer.close - server socket ${self._socketId} close.`);
                return self;
            });
    }

    createConnection() {
        return new TcpConnection();
    }

    get acceptHandler() {
        if (this._acceptHandler === null) {

            this._acceptHandler = function(info) {
                if (this._socketId !== info.socketId) {
                    return;
                }

                const self = this;
                return tcpAsync.tcpGetSocketInfo(info.clientSocketId)
                    .then(clientSocketInfo => {
                        log.info(`TcpServer.acceptHandler - accepted connection on client socket ${info.clientSocketId} from: ${JSON.stringify(clientSocketInfo)}.`);
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

        return this._acceptHandler;
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
        return tcpAsync.tcpCreate()
            .then(socketId => {
                self._socketId = socketId;
                chrome.sockets.tcpServer.onAccept.addListener(self.acceptHandler);
                return tcpAsync.tcpListen(self._socketId, self._address, self._port);
            })
            .then(() => {
                return tcpAsync.tcpGetSocketInfo(self._socketId);
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
    let promises = [];
    this._connections.forEach(val => {
        promises.push(val.close());
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
