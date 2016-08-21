const React = require("react");


module.exports = props => {
    let interfaces;
    if (props.interfaces) {
        interfaces = props.interfaces.map(item => {
            const cProps = {
                key: item.name,
                label: item.address,
                style: { fontWeight: props.selectedInterfaces.includes(item.name) ? "bold" : "inherit" },
                value: item.name
            };

            return (
                <option {...cProps} />
            );
        });
    }

    return (
        <select id="network-interfaces" multiple="true" onChange={evt => selectedInterfaceChanged(props, evt) } value={props.selectedInterfaces}>
            {interfaces}
        </select>
    );
};


function selectedInterfaceChanged(props, evt) {
    // TODO: this doesn't multi-select properly.
    let option;
    for (let i = 0; i < evt.target.childNodes.length; i++) {
        option = evt.target.childNodes[i];
        if (option.selected) {
            if (!props.selectedInterfaces.includes(option.value)) {
                props.interfaceSelectionChanged(option.value, true);
            }
        } else {
            if (props.selectedInterfaces.includes(option.value)) {
                props.interfaceSelectionChanged(option.value, false);
            }
        }
    }
}
