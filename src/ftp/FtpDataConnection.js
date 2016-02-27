"use strict";


var fileSystem = require("../fileSystem/fileSystem");
var logger = require("../logging/logger");
const TcpConnection = require("../tcp/TcpConnection");


/**
 * This is used to send data to a client using a passive connection.
 */
class DataConnection extends TcpConnection {

    constructor() {
        super();
        this.sendEncoder = null;
        this.textDecoder = null;
    }

    list(server, state, command) {
        return Promise.resolve(this._accepted)
            .then(() => {
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
                            return { entry, metaData };
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
                        return `dr-xr-xr-x 1 0 0 ${createField(4096, fileSizeLength, false)} ${month} ${day} ${hour}:${minute} ${entry.name}`;
                    } else if (entry.isFile) {
                        //return `+r,\t${entry.name}\r\n`;
                        return `-rw-r--r-- 1 0 0 ${createField(entryDatum.metaData.size, fileSizeLength, false)} ${month} ${day} ${hour}:${minute} ${entry.name}`;
                    }
                });

                // Join the strings. Send the response.
                const message = lsEntries.join("\r\n") + "\r\n";
                return send.call(this, state.binaryFileTransfer, message);

                // TEMP for debugging.
                // let heaven = "total 3844\r\ndrwxr-sr-x    2 0        10           4096 Nov  1  2003 .\r\ndrwxrwsr-x   10 0        10           4096 Nov  3  2003 ..\r\n-rw-r--r--    1 0        10        1438059 Dec 27  1994 acroread.exe\r\n-rw-r--r--    1 0        10           5674 Dec 27  1994 acroread.txt\r\n-rw-r--r--    1 0        10        1192261 Dec 27  1994 gs261exe.zip\r\n-rw-r--r--    1 0        10         174939 Dec 27  1994 gsview10.zip\r\n-rw-r--r--    1 0        10           2493 Dec 27  1994 lview.txt\r\n-rw-r--r--    1 0        10         224269 Dec 27  1994 lview31.zip\r\n-rw-r--r--    1 0        10         641702 Dec 27  1994 mpegw32h.zip\r\n-rw-r--r--    1 0        10            979 Dec 27  1994 readme.ncsa\r\n-rw-r--r--    1 0        10            140 Jan  4  1995 readme.netheaven\r\n-rw-r--r--    1 0        10          21236 Dec 27  1994 speak.exe\r\n-rw-r--r--    1 0        10           8823 Dec 27  1994 wham.txt\r\n-rw-r--r--    1 0        10         138130 Dec 27  1994 wham131.zip\r\n-rw-r--r--    1 0        10           1139 Dec 27  1994 wplany.doc\r\n-rw-r--r--    1 0        10          19123 Dec 27  1994 wplny09b.zip\r\n";
                // return send.call(this, state.binaryFileTransfer, heaven);
            })
            .then(() => {
                return "226 Transfer complete\r\n";
            });
    }

    // Override base.
    listen(address) {
        const self = this;
        this.on("accept", acceptInfo => {
            logger.info(`DataConnection.listen - accept event: ${JSON.stringify(acceptInfo)}, address: ${self.address}:${self.port}`);
            self.clientSocketId = acceptInfo.clientSocketId;
        });

        this.on("receive", receiveInfo => {
            logger.verbose(`DataConnection.listen - receive event: [${JSON.stringify(receiveInfo)}]`);
            if (self._textDecoder) {
                const dataView = new DataView(receiveInfo.data);
                const request = self._textDecoder.decode(dataView);
                logger.info(`DataConnection.listen - request [${request.trim()}]`);
            }
        });

        return super.listen(address);
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
    logger.verbose(`DataConnection.js send() - message [${message.trim()}]`);

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
            logger.verbose(`DataConnection.js send() - result [${JSON.stringify(result)}].`);
        });
}
