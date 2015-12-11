var log = require("../logging/logger");


module.exports = {

    port: 0, // Must be allowed by the chrome app manifest.json file.

    startListening(receiveCallback) {
        return tcpCreateAll(this.port, receiveCallback)
            .then(function (results) {
                return results;
            });
    }

};


function tcpCreateAll(port, receiveCallback) {
    return new Promise(function (resolve, reject) {
        chrome.system.network.getNetworkInterfaces(function (networkInterfaces) {
            var promises = networkInterfaces.map(function (networkInterface) {
                return tcpCreate()
                    .then(function (socketId) {
                        return tcpListen(socketId, networkInterface.address, port, receiveCallback)
                            .then(function (listenData) {
                                return { socketId, address: networkInterface.address, port: listenData.port };
                            });
                    });
            });

            Promise.all(promises)
                .then(function (results) {
                    log.info `tcpServer.js tcpCreateAll() - resolving: ${JSON.stringify(results)}`;
                    resolve(results);
                })
                .catch(function (err) {
                    reject(err);
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
        throw `tcpServer.js tcpListenHandler() - listen error result: ${result}.`
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