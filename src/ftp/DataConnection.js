"use strict";


var fileSystem = require("../fileSystem/fileSystem");
var logger = require("../logging/logger");
var TcpServer = require("../tcp/TcpServer");


/**
 * This is used to send data to a client using a passive connection.
 */
class DataConnection extends TcpServer {

    constructor() {
        super();
        this._clientSocketId;
        this._accepted = null; // will be a promise
        this._sendEncoder;
        this._textDecoder;
    }

    set clientSocketId(id) {
        this._clientSocketId = id;
    }
    
    set sendEncoder(encoder) {
        this._sendEncoder = encoder;
    }
    
    set textDecoder(decoder){
        this._textDecoder = decoder;
    }

    list(server, state, command, acceptedCallback) {
        return Promise.resolve(this._accepted)
            .then(() => {
                logger.verbose(`DataConnection.list() - accepted a connection from the client.`);
                var p = null;
                if (acceptedCallback) {
                    logger.verbose(`DataConnection.list() - invoking acceptedCallback.`);
                    p = acceptedCallback();
                }

                return Promise.resolve(p);
            })
            .then(() => {
                logger.verbose(`DataConnection.list() - acceptedCallback resolved.`);
                // Get the current directory.
                return Promise.resolve(fileSystem.getFileSystemEntry(state.currentDirectoryEntryId));
            })
            .then(currentDirectory => {
                // Get a list of files and directories.
                return Promise.resolve(fileSystem.getDirectoryEntries(currentDirectory));
            })
            .then(entries => {
                // TODO: make a file system metadata request to get information about each entry such as the size etc.
                let promises = entries.map(entry => {
                    return Promise.resolve(fileSystem.getMetadata(entry))
                        .then(metaData => {
                            return {entry, metaData};
                        });
                });

                return Promise.all(promises);
            })
            .then(entryData => {
                let fileSize = 4;
                entryData.forEach(entryDatum => {
                    fileSize = fileSize < entryDatum.metaData.size ? entryDatum.metaData.size : fileSize;
                });

                const fileSizeLength = ("" + fileSize).length;

                // If the command has an argument "-a" ignore it (always return all the entries).
                // Convert to "EPLF" (hopefully all clients accept it?)
                const lsEntries = entryData.map(entryDatum => {
                    const entry = entryDatum.entry;
                    const month = "Jan";
                    const day = createField(1, 2, false); // 2 chars
                    const hour = "01";
                    const minute = "01";
                    if (entry.isDirectory) {
                        //return `+/,\t${entry.name}\r\n`;
                        return `dr-xr-xr-x 1 0 0 ${createField(4096, fileSizeLength, false) } ${month} ${day} ${hour}:${minute} ${entry.name}`;
                    } else if (entry.isFile) {
                        //return `+r,\t${entry.name}\r\n`;
                        return `-rw-r--r-- 1 0 0 ${createField(entryDatum.metaData.size, fileSizeLength, false) } ${month} ${day} ${hour}:${minute} ${entry.name}`;
                    }
                });
                
                // Join the strings. Send the response.
                const message = lsEntries.join("\r\n") + "\r\n";
                return send.call(this, state.binaryFileTransfer, message);
            })
            .then(() => {
                return "226 Transfer complete\r\n";
            });
    }

    // Override base.
    startListening(address) {
        const self = this;
        this._accepted = new Promise(resolve => {
            self.once("accept", evt => {
                logger.info(`DataConnection.js accept handler() - accept event: ${JSON.stringify(evt) }, address: ${self.address}:${self.port}`);
                self.clientSocketId = evt.clientSocketId;
                resolve();
            });
        });

        this.on("receive", evt => {
            if (self._textDecoder) {
                const dataView = new DataView(evt.data);
                const request = self._textDecoder.decode(dataView);
                logger.info(`DataConnection.js receive handler() - request [${request.trim() }]`);
            }
        });

        return super.startListening(address);
    }

}


module.exports = DataConnection;


/**
 * Create a text string with specific padding.
 * @param {any} value Any value that can be converted to a string.
 * @param {number} length The length of the output string in characters.
 * @param {boolean} [leftAlignValue=true] If true the value will be aligned to the left side of the string.
 * @returns {string} A string with the length requested.
 */
function createField(value, length, leftAlignValue) {
    const lav = typeof leftAlignValue !== "boolean" ? true : leftAlignValue;
    const field = Array(length).join(" ");
    if (lav) {
        return (value + field).substring(0, length);
    } else {
        return (field + value).slice(-length);
    }
}

function send(binaryFileTransfer, message) {
    logger.verbose(`DataConnection.js send() - message [${message.trim() }]`);
    
    // TODO: refactor - shared with ftpServer.
    let encodedMessage = null;
    if (binaryFileTransfer) {
        encodedMessage = this._sendEncoder.encode(message);
    } else {
        encodedMessage = new Int8Array(message.length);
        for (let i = 0; i < message.length; i++) {
            encodedMessage[i] = message.charCodeAt(i);
        }
    }

    return Promise.resolve(this.send(this._clientSocketId, encodedMessage.buffer))
        .then(result => {
            logger.verbose(`DataConnection.js send() - result [${JSON.stringify(result) }].`);
        });
}
