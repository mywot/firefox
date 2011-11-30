/*
 lib/ajax.js
 Copyright © 2011  WOT Services Oy <info@mywot.com>

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

/*
* Ajax functionality based on Firefox SDK's "xhr" module
* */

const XMLHttpRequest = require("xhr").XMLHttpRequest;
const logger = require("log");


(function() {

	var ajax = exports.ajax = function(url, settings) {

		logger.log("- ajax.ajax");

		if(typeof url === "object") {
			settings = url;
			url = undefined;
		}

		var onComplete = function(data) {
			logger.log("- ajax.onComplete" + JSON.stringify(data));

			// if request is successful
				if(settings.success) {
					settings.success(data);
				}

				if(settings.complete) {
					settings.complete(daya);
				}
		};

		var options = {
			url: url || settings.url,
			content: settings.data || null,
			type: settings.type || 'GET'
		};


		var request = new XMLHttpRequest();

		request.open(options.type, options.url, true);

		request.onreadystatechange = function (aEvt) {
			if (request.readyState == 4) {
				if(request.status == 200) {

					var data = xml2json(request.responseXML);

					logger.log(' AJAX Response: ' + JSON.stringify(data));

					onComplete(request.responseXML);    // TODO: Use JS object in future
				}
				else {
					logger.fail('Error', request.responseText);

					if(typeof settings.onerror == "function") {
						settings.onerror(request);
					}

				}
			}
		};

		request.send(options.content);

	};

	// syntax sugar and jquery emulation for GET-requests
	var get = exports.get = function(url, settings) {

		settings = settings || {};
		settings.type = 'GET';

		return ajax(url, settings);
	};


	// syntax sugar and jquery emulation for GET-requests
	var post = exports.post = function(url, settings) {

		settings = settings || {};
		settings.type = 'POST';

		return ajax(url, settings);
	};



	/* By David Walsh from http://davidwalsh.name/convert-xml-json */
	var xml2json = function(xml) {

		var obj = {};

		if (xml.nodeType == 1) { // element
			// do attributes
			if (xml.attributes.length > 0) {
				obj["@attributes"] = {};
				for (var j = 0; j < xml.attributes.length; j++) {
					var attribute = xml.attributes.item(j);
					obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
				}
			}
		} else if (xml.nodeType == 3) { // text
			obj = xml.nodeValue;
		}

		// do children
		if (xml.hasChildNodes()) {
			for(var i = 0; i < xml.childNodes.length; i++) {
				var item = xml.childNodes.item(i);
				var nodeName = item.nodeName;
				if (typeof(obj[nodeName]) == "undefined") {
					obj[nodeName] = xml2json(item);
				} else {
					if (typeof(obj[nodeName].length) == "undefined") {
						var old = obj[nodeName];
						obj[nodeName] = [];
						obj[nodeName].push(old);
					}
					obj[nodeName].push(xml2json(item));
				}
			}
		}
		return obj;
	};

})();

