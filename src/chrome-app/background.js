chrome.app.runtime.onLaunched.addListener(function () {
    chrome.app.window.create(
        "index.html",
        {
            id: "index",
            innerBounds: {
                minWidth: 320,
                minHeight: 480
            },
            state: "maximized"
        }
        );
});