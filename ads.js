// ads.js
let storyAd = null; // Global object to store ad data

window.googletag = window.googletag || { cmd: [] };


googletag.cmd.push(function() {

    googletag.pubads().addEventListener('slotRenderEnded', function(event) {
        // do something here if you want
    });

    googletag.enableServices();
});