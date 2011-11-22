/*jshint passfail: true */

'use strict';

const { Widget } = require("widget");
const { Panel } = require("panel");
const { data } = require("self");

const tabs = require("tabs");

// imitate Google Chrome program interface
// temporary stubs for porting add-on from Chrome to Firefox
var chrome = {
    windows: require("windows").browserWindows,
    extension: {
        onConnect: {
            addListener: function(){}
        },
        connect: function() {}
    },
    i18n: {
        getMessage: function() {}
    }
};


var panel = exports.panel = Panel({
    width: 332,
    height: 400,
    contentURL: data.url("ratingwindow.html"),
    contentScriptFile: [
        data.url("jquery-1.6.4.js"),
        data.url("wot.js"),
        data.url("firefox.js"),
        data.url("background.js"),
        data.url("locale.js"),
        data.url("prefs.js"),
        data.url("ratingwindow.js")
    ]
});

panel.port.on("message", function(data) {
    console.log("Panel: on: ", data);
});

var widget = Widget({
    id: "wot-rating",
    label: "WOT reputation",
    contentURL: data.url("skin/fusion/icons/32.png"),
    panel: panel
});

var wot = {

    core: {

        log: function(s)
        {
            if (wot.debug) {
                console.log(s);
            }
        },

        /* events */

        events: {},

        trigger: function(name, params, once)
        {
            if (this.events[name]) {
                wot.log("trigger: event " + name + ", once = " + once);

                this.events[name].forEach(function(obj) {
                    try {
                        obj.func.apply(null, [].concat(params).concat(obj.params));
                    } catch (e) {
                        wot.log("trigger: event " + name + " failed with " + e);
                    }
                });

                if (once) { /* these events happen only once per bind */
                    delete(this.events[name]);
                }
            }
        },

        bind: function(name, func, params)
        {
            if (typeof(func) == "function") {
                this.events[name] = this.events[name] || [];
                this.events[name].push({ func: func, params: params || [] });

                wot.log("bind: event " + name + "\n");
                this.trigger("bind:" + name);
            }
        },

        addready: function(name, obj, func)
        {
            obj.ready = function(setready)
            {
                if (typeof(func) == "function") {
                    this.isready = setready || func.apply(this);
                } else {
                    this.isready = setready || this.isready;
                }
                if (this.isready) {
                    wot.trigger(name + ":ready", [], true);
                }
            };

            obj.isready = false;

            this.bind("bind:" + name + ":ready", function() {
                obj.ready();
            });
        },
        /* messaging */

        connections: {},

        triggeronmessage: function(port)
        {
            port.onMessage.addListener(function(data) {
                wot.trigger("message:" + data.message, [ {
                    port: port,
                    post: function(message, data) {
                        wot.post(this.port.name, message, data, this.port);
                    }
                }, data ]);
            });
        },

        listen: function(names)
        {
            if (typeof(names) == "string") {
                names = [ names ];
            }

            // TODO: Fix it!
            chrome.extension.onConnect.addListener(function(port) {
                if (names.indexOf(port.name) >= 0) {
                    wot.triggeronmessage(port);
                    wot.connections[port.name] = port;
                }
            });
        },

        connect: function(name)
        {
            var port = this.connections[name];

            if (port) {
                return port;
            }

            // TODO: Fix it!
            port = chrome.extension.connect({ name: name });

            if (port) {
                this.triggeronmessage(port);
                this.connections[name] = port;
            }

            return port;
        },

        post: function(name, message, data, port)
        {
            port = port || this.connect(name);

            if (port) {
                data = data || {};
                data.message = name + ":" + message;
                this.log("post: posting " + data.message + "\n");
                port.postMessage(data);
            }
        },

        /* i18n */

        i18n: function(category, id, shorter)
        {
            var msg = category;

            if (shorter) {
                msg += "__short";
            }

            if (id != null) {
                msg += "_" + id;
            }

            // TODO: Fix it!
//            var result = chrome.i18n.getMessage(msg);
//
//            if (result == null) {
//                result = this.debug ? "!?" : "";
//            }
//
//            return result;
        }


    }
};

console.log("The add-on is running.");
