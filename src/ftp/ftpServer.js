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

    getPassword() {
        return _password;
    }

    getUsername() {
        return _username;
    }

    setAllowAnonymousLogin(allow) {
        _allowAnonymousLogin = allow;
        _username = allow ? "anonymous" : _username;
    }

    /**
     * A message to display after the user successfully logs in.
     * @param {string|string[]} message The message to display, Passing an array will cause more than one message line to be returned to the client. Do not include any FTP response codes in the message.
     */    
    setLoginMessage(message) {
        _loginMessage = message;
    }

    setPassword(password) {
        _password = password;
    }

    setUsername(username) {
        _username = username;
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


const _WELCOME_MESSAGE = "Welcome to chftpd.";


var _allowAnonymousLogin = true;
var _commandHandler = new CommandHandler();
var _loginMessage = "Logged in to chftpd.";
var _password = null;
var _sendEncoder = new TextEncoder("utf8");
var _socketState = {};
var _textDecoder = new TextDecoder("utf8");
var _username = "anonymous";


function acceptCallbackHandler(data) {
    console.log(`ftpServer.js acceptCallbackHandler() - ${JSON.stringify(data) }.`);

    _socketState[data.clientSocketId] = {
        lastRequestTime: Date.now()
    };
    
    var message = `220 ${_WELCOME_MESSAGE}${this.getAllowAnonymousLogin() ? "Anonymous login allowed; please end email as password." : ""}\r\n`;
    
    // Create the FTP connection request ack ArrayBuffer.
    var response = _sendEncoder.encode(message);
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
