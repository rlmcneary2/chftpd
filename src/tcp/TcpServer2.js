"use strict";


class TcpServer {

    constructor() {
        this.address = null;
        this.port = 0;
    }

    getNetworkInterfaces() {
        return getIPv4NetworkInterfaces();
    }

    startListening(address, receiveCallback) {
        this.address = address;
        return tcpCreateAndListen(this.address, this.port, receiveCallback)
            .then(function (results) {
                return results;
            });
    }

}


module.exports = TcpServer;


function getIPv4NetworkInterfaces() {
    return new Promise(function (resolve, reject) {
        chrome.system.network.getNetworkInterfaces(function (networkInterfaces) {
            var err = chrome.runtime.lastError;
            if (err) {
                reject(err);
            }

            if (typeof networkInterfaces === "undefined" || networkInterfaces === null) {
                resolve([]);
            }

            var interfaces = [];
            for (var i = 0; i < networkInterfaces.length; i++) {
                if (networkInterfaces[i].prefixLength === 24) {
                    interfaces.push(networkInterfaces[i]);
                }
            }

            resolve(interfaces);
        });
    });
}

function tcpCreateAndListen(address, port, receiveCallback) {
    return new Promise(function (resolve, reject) {
        tcpCreate()
            .then(function (socketId) {
                tcpListen(socketId, address, port, receiveCallback)
                    .then(function (listenData) {
                        resolve({ socketId, address, port: listenData.port });
                    });
            });
    });
}

function tcpCreate() {
    return new Promise(function (resolve, reject) {
        chrome.sockets.tcpServer.create({ name: "chftpd" }, function (createInfo) {
            console.log(`tcpServer.js tcpCreate() - socketId ${createInfo.socketId}.`);
            resolve(createInfo.socketId);
        });
    });
}

function tcpGetSocketInfo(socketId) {
    return new Promise(function (resolve, reject) {
        chrome.sockets.tcpServer.getInfo(socketId, function (socketInfo) {
            console.log(`tcpServer.js tcpGetSocketInfo() - socketInfo: ${JSON.stringify(socketInfo) }.`);
            resolve (socketInfo);
        });
    });
}

function tcpListen(socketId, address, port, receiveCallback) {
    return new Promise(function (resolve, reject) {
        console.log(`tcpServer tcpListen() - address: ${address}, port: ${port}.`);
        chrome.sockets.tcpServer.listen(socketId, address, port, function (result) {
            Promise.resolve(tcpListenHandler(result, socketId, port, receiveCallback))
                .then(function (outPort) {
                    resolve({ port: outPort });
                });
        });
    });
}

function tcpListenHandler(result, socketId, port, receiveCallback) {
    if (result < 0) {
        throw `tcpServer.js tcpListenHandler() - listen error result: ${result}.`;
    }

    return Promise.resolve()
        .then(function () {
            if (port === 0) {
                return tcpGetSocketInfo(socketId)
                    .then(function (socketInfo) {
                        return socketInfo.localPort;
                    });
            }
            else {
                return Promise.resolve(port);
            }
        })
        .then(function (outPort) {
            tcpAddOnAcceptHandler(socketId, receiveCallback);
            return outPort;
        });
}

function tcpAddOnAcceptHandler(socketId, receiveCallback) {
    chrome.sockets.tcpServer.onAccept.addListener(function (acceptInfo) {
        if (acceptInfo.socketId !== socketId) {
            return;
        }

        chrome.sockets.tcp.onReceive.addListener(function (receiveInfo) {
            if (receiveInfo.socketId === acceptInfo.clientSocketId) {
                receiveCallback(receiveInfo.data);
            }
        });

        chrome.sockets.tcp.setPaused(acceptInfo.clientSocketId, false);
    });
}
