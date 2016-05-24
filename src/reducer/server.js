const actions = require("../action/actions").actions;


module.exports = (state = { binding: {} }, action) => {

    let nextState = state;
    switch (action.type) {
        
        case actions.interfaceGetAllEnd:{
            nextState = Object.assign({}, state);
            nextState.binding.interfaces = action.interfaces;
            break;
        }

        case actions.interfaceGetAllStart: {
            nextState = Object.assign({}, state);
            nextState.binding.interfaces = [];
            break;
        }

        case actions.interfaceSelectionChanged: {
            nextState = Object.assign({}, state);
            nextState.binding.interfaces = [...state.binding.interfaces];
            const a = nextState.binding.interfaces.find(item => {
                return item.address === action.address;
            });
            if (a) {
                a.selected = action.selected;
            }
            break;
        }

    }

    return nextState;
};
