"use strict";


var TcpServer = require("../tcp/TcpServer");
var CommandHandler = require("./CommandHandler");


class FtpServer extends TcpServer{

    getAllowAnonymousLogin() {
        return _allowAnonymousLogin;
    }

    getControlPort() {
        return this.port;
    }
    
    setAllowAnonymousLogin(allow){
        _allowAnonymousLogin = allow;
    }
    
    setWelcomeMessage(message) {
        _welcomeMessage = message;
    }

    /**
     * Start listening for FTP connections from clients.
     * @param {string} address The address to bind to.
     * @returns {Promise|object} A Promise that resolves to an object with information.
     */    
    startListening(address) {
        var self = this;
        return super.startListening(address, {

            acceptCallback(data) {
                acceptCallbackHandler.call(self, data);
            },

            receiveCallback(receiveInfo) {
                receiveCallbackHandler.call(self, receiveInfo);
            }

        });
    }

}


var _socketState = {};
var _allowAnonymousLogin = true;
var _commandHandler = new CommandHandler();
var _sendEncoder = new TextEncoder("utf8");
var _textDecoder = new TextDecoder("utf8");
var _welcomeMessage = "Welcome to chftpd.";


function acceptCallbackHandler(data) {
    console.log(`ftpServer.js acceptCallbackHandler() - ${JSON.stringify(data) }.`);

    _socketState[data.clientSocketId] = {
        lastRequestTime: Date.now()
    };
    
    // Create the FTP connection request ack ArrayBuffer.
    var response = _sendEncoder.encode(`220 ${_welcomeMessage}\r\n`);
    this.send(data.clientSocketId, response.buffer)
        .then(result => {
            console.log(`ftpServer.js acceptCallbackHandler().then() - ${JSON.stringify(result) }.`);
        });
}

function receiveCallbackHandler(receiveInfo) {
    var dataView = new DataView(receiveInfo.data);
    var request = _textDecoder.decode(dataView);
    console.log(`ftpServer.js receiveCallbackHandler() - "${request}".`);

    var state = _socketState[receiveInfo.clientSocketId];

    _commandHandler.handleRequest(this, state, request, message => {
        var encodedMessage = _sendEncoder.encode(message);
        return this.send(receiveInfo.clientSocketId, encodedMessage.buffer);
    })
        .then(result => {
            state.lastRequestTime = Date.now();
            this.emit("command-arrived", result.command.request);
        });
}


module.exports = new FtpServer();
