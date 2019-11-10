jQuery(document).ready(function () {
    var iframe = window.frames.gamecontrol;
    jQuery(window).keydown(function (e) {
        iframe.postMessage(e.keyCode, "*");
    });

    jQuery(window).keyup(function (e) {
        iframe.postMessage("stop "+e.keyCode, "*");
    });
});
