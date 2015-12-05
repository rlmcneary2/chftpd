

module.exports = {

    port: 21, // Must be allowed by the chrome app manifest.json file.

    startListening(receiveCallback) {
        return tcpCreateAll(this.port, receiveCallback)
            .then(function (result) {
                return;
            });
    }

};


function tcpCreateAll(port, receiveCallback) {
    return new Promise(function (resolve, reject) {
        chrome.system.network.getNetworkInterfaces(function (networkInterfaces) {
            var promises = networkInterfaces.map(function (networkInterface) {
                return tcpCreate()
                    .then(function (socketId) {
                        return tcpListen(socketId, networkInterface.address, port, receiveCallback);
                    });
            });

            Promise.all(promises)
                .then(function () {
                    resolve();
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
            console.log (`tcpServer.js tcpCreate() - socketId ${createInfo.socketId}.`);
            resolve(createInfo.socketId);
        });
    });
}

function tcpListen(socketId, address, port, receiveCallback) {
    return new Promise(function (resolve, reject) {
        console.log(`tcpServer tcpListen() - address: ${address}, port: ${port}.`);
        chrome.sockets.tcpServer.listen(socketId, address, port, function (result) {
            if (0 <= result) {
                chrome.sockets.tcpServer.onAccept.addListener(function (acceptInfo) {
                    if (acceptInfo.socketId !== socketId) {
                        return;
                    }

                    chrome.sockets.tcp.onReceive.addListener(function (receiveInfo) {
                        if (receiveInfo.socketId !== acceptInfo.clientSocketId)
                            return;
                            
                        // receiveInfo.data is an arrayBuffer.
                        receiveCallback(receiveInfo.data);
                    });

                    chrome.sockets.tcp.setPaused(acceptInfo.clientSocketId, false);
                });

                resolve(result);
            } else {
                reject(result);
            }
        });
    });
}
