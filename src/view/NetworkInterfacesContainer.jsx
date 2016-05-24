const action = require("../action/actions");
const {connect} = require("react-redux");
const NetworkInterfaces = require("./NetworkInterfaces.jsx");


module.exports = connect(mapStateToProps, mapDispatchToProps, mergeProps)(NetworkInterfaces);


function mapStateToProps(state) {
    debugger;
    return Object.assign({}, state.server);
}

function mapDispatchToProps(dispatch) {
    return {

        interfaceGetAll() {
            dispatch(action.interfaceGetAll());
        },

        interfaceSelectionChanged(address, selected) {
            dispatch(action.interfaceSelectionChanged(address, selected));
        }

    };
}

function mergeProps(stateProps, dispatchProps, ownProps) {
    debugger;
    const props = Object.assign({}, ownProps, stateProps, dispatchProps);

    if (!props.binding.interfaces) {
        setTimeout(() => {
            props.interfaceGetAll();
        });
    }

    return props;
}
