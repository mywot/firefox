/*
 firefox.js
 Copyright © 2009, 2010, 2011  WOT Services Oy <info@mywot.com>

 This file is part of WOT.

 WOT is free software: you can redistribute it and/or modify it
 under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 WOT is distributed in the hope that it will be useful, but WITHOUT
 ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
 License for more details.

 You should have received a copy of the GNU General Public License
 along with WOT. If not, see <http://www.gnu.org/licenses/>.
 */



$.extend(wot, { browser: {

    opentab: function(url, callback){
        // it will not work
//        var tabs = require("tabs");
//
//        tabs.open({
//            url: url,
//            onReady: callback
//        });
    },

    enumaratetabs: function(callback) {

        // it will not work
//        var tabs = require('tabs');
//
//        for each (var tab in tabs) {
//            wot.log(tab.title);
//            callback(tab);
//        }

    },

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

    load_async: function(url, data, callback, asyncronous)
    {
        asyncronous = asyncronous == undefined ? true : asyncronous;
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function() {
            if (this.readyState == 4) {
                callback(this);
            }
        };

        xhr.open("GET", url, asyncronous);
        xhr.send(data);

    },


    load_sync: function(url, data, callback)
    {
        wot.log("browser/load_sync");
        wot.browser.load_async(url, data, callback, false);
    }

}

});