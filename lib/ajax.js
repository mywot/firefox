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

const utils = require("utils");
const logger = require("logger");


(function() {

	var ajax = exports.ajax = function(url, settings) {

		logger.log("- ajax.ajax");

		if(typeof url === "object") {
			settings = url;
			url = undefined;
		}

		var onComplete = function(data) {

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

					var data = utils.xml2jso(request.responseXML);

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

})();

