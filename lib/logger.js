/*
 log.js
 Copyright © 2009-2011  WOT Services Oy <info@mywot.com>

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

constants = require("constants").constants;

// Log to Console if Debug mode is on
exports.log = function(data) {
	if(constants.debug) {
		console.log("log.js # " + data);
	}
};

// Log to Console anyway, and Stop execution if Debug=true
exports.fail = function(data, error) {
	console.error(data);
	if(constants.debug) {
		error = error || {};
		console.exception(error);
		throw error;
	}
};