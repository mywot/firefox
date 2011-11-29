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

/*

// sample from http://stackoverflow.com/questions/6509257/working-with-xml-in-a-firefox-add-onex-jetpack

var request = new require("xhr").XMLHttpRequest();

request.open('GET', 'https://to-the-api.com', true);

request.onreadystatechange = function (aEvt) {
	if (request.readyState == 4) {
		if(request.status == 200) {
			var xmls = request.responseXML.documentElement.querySelectorAll("xmls");
			for (var i = 0; i < xmls.length; i++) {
				console.log("xml", i, xmls[i], xmls[i].textContent);
			}
		}
		else {
			console.log('Error', request.responseText);
		}
	}
};
request.send(null);

*/


var Request = require("request").Request;

(function() {

	var ajax = exports.ajax = function(url, settings){

		if(typeof url === "object") {
			settings = url;
			url = undefined;
		}

		var onComplete = function(response) {
			console.log("\nAJAX:");
			console.log(response.status + " / " + response.responseText);
			console.log(response.text);

			// if request is successful
			if(parseInt(status) <= 400) {
				if(settings.success) {
					settings.success(response);
				}
			}
			else {
				if(settings.error) {
					settings.error(response);
				}
			}

		};

		var options = {
			url: url || settings.url,
			onComplete: onComplete,
			content: settings.data || "",
			contentType: settings.contentType || "application/x-www-form-urlencoded",
			type: settings.type || 'GET'
		};

		var req = Request(options);

		if(options.type == 'POST') {
			req.post();
		} else {
			req.get();
		}

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


	var processXml = function(text) {

	};


})();

