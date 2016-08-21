"use strict";


const actions = require("../action/actions").actions;


/*
{
    interfaces: [
        {
            address: "192.168.1.1",
            name: "{GUID}",
            prefixLength: 0
        }
    ],
    selectedInterfaces: ["{GUID}"]
}
*/

module.exports = (state = { selectedInterfaces: [] }, action) => {

    let nextState;
    switch (action.type) {

        case actions.interfaceGetAllStart: {
            nextState = Object.assign({}, state);
            if (nextState.interfaces) {
                delete nextState.interfaces;
            }
            break;
        }

        case actions.interfaceGetAllEnd: {
            nextState = Object.assign({}, state);
            nextState.interfaces = action.interfaces;
            break;
        }

        case actions.interfaceSelectionChanged: {
            nextState = Object.assign({}, state);
            if (action.selected) {
                if (!nextState.selectedInterfaces.includes(action.name)) {
                    nextState.selectedInterfaces = [...state.selectedInterfaces, action.name];
                }
            } else {
                nextState.selectedInterfaces = state.selectedInterfaces.filter(item => {
                    return item !== action.name;
                });
            }
            break;
        }

    }

    return nextState || state;
};
