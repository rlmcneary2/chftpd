const ftpServer = require("../ftp/ftpServer");


module.exports = {

    actions: Object.freeze({
        interfaceGetAllEnd: "INTERFACE-GET-ALL-END",
        interfaceGetAllStart: "INTERFACE-GET-ALL-START",
        interfaceSelectionChanged: "INTERFACE-SELECTION-CHANGED"
    }),

    interfaceGetAll() {
        return dispatch => {
            dispatch(this.interfaceGetAllStart());

            const self = this;
            ftpServer.getNetworkInterfaces()
                .then(result => {
                    dispatch(self.interfaceGetAllEnd(result));
                });
        };
    },

    interfaceGetAllEnd(interfaces) {
        return { interfaces, type: this.actions.interfaceGetAllEnd };
    },

    interfaceGetAllStart() {
        return { type: this.actions.interfaceGetAllStart };
    },

    interfaceSelectionChanged(address, selected) {
        return { address, selected, type: this.actions.interfaceSelectionChanged };
    }

};
